import type { BlurhashRequest } from '../../types'
import { parseAspectRatio } from '../transform/params'
import { readBlurIntent, readImageIntent } from '../renderIntent'
import { isPlaceholderFormat, isPlaceholderQuality } from './qualities'

const parseHeader = (h: string): BlurhashRequest => {
  const out: BlurhashRequest = {}
  for (const part of h.split(';')) {
    const s = part.trim()
    if (!s) continue
    const eq = s.indexOf('=')
    if (eq === -1) {
      if (isPlaceholderQuality(s)) out.quality = out.quality ?? s
      else if (isPlaceholderFormat(s)) out.format = out.format ?? s
      else out.ar = out.ar ?? parseAspectRatio(s)
      continue
    }
    const k = s.slice(0, eq).trim().toLowerCase()
    const v = s.slice(eq + 1).trim()
    if (k === 'ar') out.ar = parseAspectRatio(v)
    else if ((k === 'q' || k === 'quality') && isPlaceholderQuality(v)) out.quality = v
    else if (k === 'format' && isPlaceholderFormat(v)) out.format = v
  }
  return out
}

// A placeholder is on by default: an undeclared read gets the `sm` tier (cropped to any declared
// render ratio), an explicit blur intent or X-Blurhash header picks its own tier/format, and
// `context: { blur: false }` opts a read out entirely.
export const readRequest = (
  req: { context?: Record<string, unknown>; headers?: { get?: (k: string) => string | null } } | undefined,
): BlurhashRequest => {
  if (req?.context?.blur === false) return {}
  const blur = readBlurIntent(req)
  if (blur.declared) return { declared: true, ar: readImageIntent(req).aspectRatio, quality: blur.quality, format: blur.format }
  const header = req?.headers?.get?.('x-blurhash')
  if (header) return { declared: true, ...parseHeader(header) }
  return { declared: true, implicit: true, ar: readImageIntent(req).aspectRatio, quality: 'sm' }
}

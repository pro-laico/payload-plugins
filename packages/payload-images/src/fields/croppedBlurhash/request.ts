/**
 * What the read asked the placeholder for: the declared render (Local API `context.image`/
 * `context.blur`), else an `X-Blurhash` header (REST). Absent → the raw `sm`-tier hash.
 */
import { parseAspectRatio } from '../../lib/transform/params'
import { readBlurIntent, readImageIntent } from '../../lib/renderIntent'
import { isPlaceholderFormat, isPlaceholderQuality } from '../../lib/placeholders/qualities'
import type { BlurhashRequest } from '../../types'

/** Parse an `X-Blurhash` header: a bare ratio (`16/9`) or a `;`-list (`ar=16/9; q=md; format=hash`). */
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

/** The placeholder request off the operation: the declared render (Local API), else the `X-Blurhash` header (REST). */
export const readRequest = (
  req: { context?: Record<string, unknown>; headers?: { get?: (k: string) => string | null } } | undefined,
): BlurhashRequest => {
  const image = readImageIntent(req)
  const blur = readBlurIntent(req)
  if (image.declared || blur.declared) return { ar: image.aspectRatio, quality: blur.quality, format: blur.format }
  const header = req?.headers?.get?.('x-blurhash')
  return header ? parseHeader(header) : {}
}

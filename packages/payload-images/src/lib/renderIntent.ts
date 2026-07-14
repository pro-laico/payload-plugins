import { FITS, FORMATS, parseAspectRatio } from './transform/params'
import type { ParsedBlurIntent, ParsedRenderIntent } from '../types'
import { isPlaceholderFormat, isPlaceholderQuality } from './placeholders/qualities'

export const RESPONSIVE_IMAGE_SELECT = {
  alt: true,
  src: true,
  srcset: true,
  placeholder: true,
} as const

export const readImageIntent = (req: { context?: Record<string, unknown> } | undefined): ParsedRenderIntent => {
  const raw = req?.context?.image
  if (typeof raw !== 'object' || raw === null) return { declared: false }
  const out: ParsedRenderIntent = { declared: true }
  if ('aspectRatio' in raw && (typeof raw.aspectRatio === 'number' || typeof raw.aspectRatio === 'string'))
    out.aspectRatio = parseAspectRatio(raw.aspectRatio)
  if ('quality' in raw && typeof raw.quality === 'number' && Number.isFinite(raw.quality)) out.quality = raw.quality
  if ('fit' in raw) out.fit = FITS.find((f) => f === raw.fit)
  if ('format' in raw) out.format = FORMATS.find((f) => f === raw.format)
  return out
}

export const readBlurIntent = (req: { context?: Record<string, unknown> } | undefined): ParsedBlurIntent => {
  const raw = req?.context?.blur
  if (typeof raw !== 'object' || raw === null) return { declared: false }
  const out: ParsedBlurIntent = { declared: true }
  if ('quality' in raw && isPlaceholderQuality(raw.quality)) out.quality = raw.quality
  if ('format' in raw && isPlaceholderFormat(raw.format)) out.format = raw.format
  return out
}

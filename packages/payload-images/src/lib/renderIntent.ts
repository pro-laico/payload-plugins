/**
 * The read-side render contract: a getter declares WHAT it's rendering on the read
 * (`context: { image, blur }`), and the doc comes back self-sufficient — virtual `src`/`srcset`
 * built for exactly that render, `croppedBlurHash` a finished placeholder for the same box.
 * `<ResponsiveImage>` then just paints the doc; no config, no URL math, no client anything
 * (the Sanity-style "pass a client/config to a builder at every call site" dance inverted).
 *
 * Everything here is validated structurally — `context` is an untyped bag, nothing is trusted.
 */
import { FITS, type Fit, FORMATS, type Format, parseAspectRatio } from '../transform/params'
import { isPlaceholderFormat, isPlaceholderQuality, type PlaceholderFormat, type PlaceholderQuality } from '../blurhash/qualities'

/** A render aspect ratio: `16/9`, `"16/9"`, or `"16:9"`. */
export type AspectRatio = number | `${number}/${number}` | `${number}:${number}`

/** What a read declares about the render it's fetching for — pass as `context.image`. */
export interface ImageRenderIntent {
  /** Render aspect ratio — shapes the srcset/src `h` and the placeholder crop. Omit for the natural ratio. */
  aspectRatio?: AspectRatio
  /** Transform quality (1–100). Default 75. */
  quality?: number
  /** Transform fit. Default `cover`. */
  fit?: Fit
  /** Output format. Default `auto` (negotiated per browser). */
  format?: Format
}

/** What a read declares about the placeholder it wants — pass as `context.blur`.
 *  The crop ratio comes from `context.image.aspectRatio`. */
export interface BlurRenderIntent {
  /** Placeholder tier: `xs`…`xl` (blurhash) or `xxl`/`x3` (micro-webp). Default `sm`. */
  quality?: PlaceholderQuality
  /** `uri` (default): a finished data URI, ready to paint. `hash`: the cropped raw hash string. */
  format?: PlaceholderFormat
}

/** The full declared render — the `context` a getter passes to `payload.findByID`. */
export interface ImageRenderContext {
  image?: ImageRenderIntent
  blur?: BlurRenderIntent
}

/** The doc shape a render-declared read returns ({@link RESPONSIVE_IMAGE_SELECT}). */
export interface ResponsiveImageDoc {
  id: string | number
  alt?: string | null
  src?: string | null
  srcset?: string | null
  croppedBlurHash?: string | null
}

/**
 * The getter a project writes around `payload.findByID` (plus its own caching/access rules —
 * the plugin never fetches). Select {@link RESPONSIVE_IMAGE_SELECT} and pass the render as
 * `context`; hand the result's fields straight to `<ResponsiveImage>`.
 */
export type ImageGetter = (id: string | number, render?: ImageRenderContext) => Promise<ResponsiveImageDoc | null>

/** The lean select for a read that feeds `<ResponsiveImage>` — everything it renders, nothing else. */
export const RESPONSIVE_IMAGE_SELECT = {
  alt: true,
  src: true,
  srcset: true,
  croppedBlurHash: true,
} as const

/** {@link ImageRenderIntent} after validation, ready for the field hooks. */
export interface ParsedRenderIntent {
  /** True when the read declared `context.image` at all (even empty). */
  declared: boolean
  aspectRatio?: number
  quality?: number
  fit?: Fit
  format?: Format
}

/** {@link BlurRenderIntent} after validation. */
export interface ParsedBlurIntent {
  /** True when the read declared `context.blur` at all (even empty). */
  declared: boolean
  quality?: PlaceholderQuality
  format?: PlaceholderFormat
}

/** Read + validate `context.image` off the operation (Local API). Absent → `declared: false`. */
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

/** Read + validate `context.blur` off the operation (Local API). Absent → `declared: false`. */
export const readBlurIntent = (req: { context?: Record<string, unknown> } | undefined): ParsedBlurIntent => {
  const raw = req?.context?.blur
  if (typeof raw !== 'object' || raw === null) return { declared: false }
  const out: ParsedBlurIntent = { declared: true }
  if ('quality' in raw && isPlaceholderQuality(raw.quality)) out.quality = raw.quality
  if ('format' in raw && isPlaceholderFormat(raw.format)) out.format = raw.format
  return out
}

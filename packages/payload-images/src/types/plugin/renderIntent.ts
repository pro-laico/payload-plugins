/**
 * The read-side render contract types: what a getter declares on the read (`context: { image,
 * blur }`), the self-sufficient doc it returns, and the validated intents the field hooks act on.
 */
import type { Fit, Format } from '../transform/format'
import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

/** A render aspect ratio: a number (`16 / 9`) or the `"16:9"` string form. */
export type AspectRatio = number | `${number}:${number}`

/** What a read declares about the render it's fetching for — pass as `context.image`. */
export interface ImageRenderIntent {
  /** Shapes the srcset/src `h` and the placeholder crop. Omit for the natural ratio. */
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
  /** `uri` (default): a finished data URI. `hash`: the cropped raw hash string. */
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

/** The getter a project writes around `payload.findByID` (its own caching/access — the plugin
 *  never fetches). Select {@link RESPONSIVE_IMAGE_SELECT}, pass the render as `context`, hand
 *  the result's fields straight to `<ResponsiveImage>`. */
export type ImageGetter = (id: string | number, render?: ImageRenderContext) => Promise<ResponsiveImageDoc | null>

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

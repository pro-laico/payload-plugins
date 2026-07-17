import type { Fit, Format } from '../transform/format'
import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

export type AspectRatio = number | `${number}:${number}`

export interface ImageRenderIntent {
  aspectRatio?: AspectRatio
  quality?: number
  fit?: Fit
  format?: Format
}

export interface BlurRenderIntent {
  quality?: PlaceholderQuality
  format?: PlaceholderFormat
}

export interface ImageRenderContext {
  image?: ImageRenderIntent
  blur?: BlurRenderIntent
}

export interface ResponsiveImageDoc {
  id: string | number
  alt?: string | null
  /** The ratio this doc was rendered for: what the read declared, else the image's natural one.
   * Spreading the doc into `<ResponsiveImage>` is what keeps its CSS box matching the crop. */
  aspectRatio?: number | null
  src?: string | null
  srcset?: string | null
  placeholder?: string | null
}

export interface ParsedRenderIntent {
  declared: boolean
  aspectRatio?: number
  quality?: number
  fit?: Fit
  format?: Format
}

export interface ParsedBlurIntent {
  declared: boolean
  quality?: PlaceholderQuality
  format?: PlaceholderFormat
}

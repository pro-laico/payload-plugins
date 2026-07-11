/** The result of upload-time image analysis — every derived value from one Sharp decode. */
import type { ImagePalette } from './palette'

export interface ImageMetadataAnalysis {
  /** Every stored placeholder tier, keyed by stored field name. */
  placeholderFields: Record<string, string>
  palette: ImagePalette
  hasAlpha: boolean
  /** No sampled pixel is actually transparent (approximate — from the 64px sample). */
  isOpaque: boolean
  /** Saliency-based focal suggestion (percentages), when Sharp's attention crop reports one. */
  attention?: { x: number; y: number }
}

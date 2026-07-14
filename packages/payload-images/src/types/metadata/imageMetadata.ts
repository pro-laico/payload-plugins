import type { ImagePalette } from './palette'

export interface ImageMetadataAnalysis {
  placeholderFields: Record<string, string>
  palette: ImagePalette
  hasAlpha: boolean
  isOpaque: boolean
  attention?: { x: number; y: number }
}

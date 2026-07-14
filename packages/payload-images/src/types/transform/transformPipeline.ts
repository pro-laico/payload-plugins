import type { HotspotOpts } from './geometry'
import type { Fit, OutputFormat } from './format'

export interface TransformInput {
  w?: number
  h?: number
  fit: Fit
  quality: number
  format: OutputFormat
  focalX?: number | null
  focalY?: number | null
  hotspot?: HotspotOpts
  maxInputPixels?: number
}

export interface TransformOutput {
  data: Buffer
  format: OutputFormat
  width: number
  height: number
  mimeType: string
}

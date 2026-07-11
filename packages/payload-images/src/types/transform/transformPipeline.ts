/** The Sharp transform's input request and its encoded output. */
import type { Fit, OutputFormat } from './format'
import type { HotspotOpts } from './geometry'

export interface TransformInput {
  w?: number
  h?: number
  fit: Fit
  quality: number
  format: OutputFormat
  focalX?: number | null
  focalY?: number | null
  hotspot?: HotspotOpts
  /** Max source pixels Sharp will decode (decompression-bomb + memory guard). Default ~100MP. */
  maxInputPixels?: number
}

export interface TransformOutput {
  data: Buffer
  format: OutputFormat
  width: number
  height: number
  mimeType: string
}

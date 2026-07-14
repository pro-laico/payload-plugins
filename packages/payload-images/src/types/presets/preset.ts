import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'

export interface PresetSpec {
  width?: number
  height?: number
  aspectRatio?: AspectRatio
  fit?: Fit
  quality?: number
  format?: OutputFormat
}

export interface PresetEntry extends PresetSpec {
  template?: string | null
  name?: string | null
}

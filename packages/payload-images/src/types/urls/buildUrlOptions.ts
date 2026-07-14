import type { Fit, Format } from '../transform/format'
import type { AspectRatio } from '../plugin/renderIntent'

export interface BuildUrlOptions {
  fit?: Fit
  quality?: number
  format?: Format
  aspectRatio?: AspectRatio
  baseUrl?: string
  path?: string
  version?: string
  preset?: string
}

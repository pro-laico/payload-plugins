import type { BuildUrlOptions } from './buildUrlOptions'

export interface BuildSrcsetOptions extends BuildUrlOptions {
  pixelStep?: number | number[]
  maxWidth?: number
  defaultWidth?: number
}

export interface BuildSrcsetResult {
  srcset: string
  src: string
}

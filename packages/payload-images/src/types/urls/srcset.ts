/** Options + result for the responsive `srcset` builder. */
import type { BuildUrlOptions } from './buildUrlOptions'

export interface BuildSrcsetOptions extends BuildUrlOptions {
  /** A number = the step increment (default 50); an array = an explicit curated width ladder. */
  pixelStep?: number | number[]
  /** The source image's intrinsic width — caps the srcset (no upscaling). */
  sourceWidth?: number
  /** Hard ceiling. Default 4096. */
  maxWidth?: number
  /** Width used for the plain `src` fallback. Defaults to min(top, 1280). */
  defaultWidth?: number
}

export interface BuildSrcsetResult {
  srcset: string
  src: string
}

/** Options + result for the responsive `srcset` builder. */
import type { BuildUrlOptions } from './buildUrlOptions'

export interface BuildSrcsetOptions extends BuildUrlOptions {
  /** A number = the step increment (default 50); an array = an explicit curated width ladder. */
  pixelStep?: number | number[]
  /** Hard ceiling. Default 4096. A populated doc's intrinsic width also caps the srcset (no upscaling). */
  maxWidth?: number
  /** Width used for the plain `src` fallback. Defaults to min(top, 1280). */
  defaultWidth?: number
}

export interface BuildSrcsetResult {
  srcset: string
  src: string
}

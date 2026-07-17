import type { Format } from './format'

export interface TransformConstraints {
  /** Largest width/height the endpoint will render. Anything bigger is rejected. */
  maxDimension: number
  /** Accepted `q=` range, as `[min, max]`. */
  qualityRange: [number, number]
  /** Quality used when a read doesn't ask for one. */
  defaultQuality: number
  /** Formats the endpoint may serve. */
  formats: Format[]
  /** Format used when `fmt` is absent or `auto` can't decide. */
  defaultFormat: Format
  /** Let `fmt=auto` pick AVIF over WebP when the browser accepts it. */
  preferAvif: boolean
  /** Requested widths snap to this step, so a ladder can't mint unbounded variants. */
  dimensionStep: number
  /** Explicit allowed widths, instead of snapping by `dimensionStep`. */
  widthLadder?: number[]
  /** Decode guard: reject a source whose pixel count exceeds this. */
  maxInputPixels: number
}

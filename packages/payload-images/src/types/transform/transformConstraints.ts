/** The endpoint's tunable limits — the anti-DoS / decode guards and format policy. */
import type { Format } from './format'

export interface TransformConstraints {
  /** Hard ceiling on either output dimension. */
  maxDimension: number
  /** [min, max] clamp for quality. */
  qualityRange: [number, number]
  /** Quality used when the request omits `q`. */
  defaultQuality: number
  /** Formats the endpoint may emit. */
  formats: Format[]
  /** Format used when the request omits `fmt`. */
  defaultFormat: Format
  /** Auto-negotiate AVIF when the browser accepts it. Off by default — AVIF encodes far slower
   *  than WebP, so `fmt=auto` serves WebP for a fast cold path (explicit `fmt=avif` still works). */
  preferAvif: boolean
  /** Snap requested `w`/`h` to a grid of this many px before transforming + caching, collapsing
   *  the continuous dimension space to a finite set — anti-DoS (a caller can't force unbounded
   *  generation with `w=1,2,3,…`). Default 50. Set `<= 1` to honor exact dimensions. */
  dimensionStep: number
  /** Max source pixels (w×h) Sharp will decode — decompression-bomb / memory guard. Default ~100MP. */
  maxInputPixels: number
}

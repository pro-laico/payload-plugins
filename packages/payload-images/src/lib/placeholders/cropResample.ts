/**
 * BlurHash crop by resampling: evaluate the series over the crop window at a small sample grid,
 * then re-encode — "decode → crop → re-encode" without ever materializing an image. Matches what
 * stock blurhash tooling produces; kept as the comparison baseline for the coefficient projection.
 */
import type { CropWindow } from './window'
import { decodeToLinearGrid, encodeCoefficients, encodeLinearGrid, parseBlurhash } from './codec'

export interface CropResampleOptions {
  /** Output components. Default: same as the source hash. */
  cx?: number
  cy?: number
  /** Sample grid for the round-trip. Default 32 — plenty above Nyquist for ≤9 components. */
  samples?: number
  /** Stock wolt encode norms instead of round-trip-exact orthogonal ones. Default false. */
  stockNorms?: boolean
}

export const cropBlurhashResample = (hash: string, window: CropWindow, opts: CropResampleOptions = {}): string => {
  const parsed = parseBlurhash(hash)
  const samples = opts.samples ?? 32
  const grid = decodeToLinearGrid(parsed, samples, samples, window)
  return encodeCoefficients(encodeLinearGrid(grid, opts.cx ?? parsed.cx, opts.cy ?? parsed.cy, { orthonormal: !opts.stockNorms }))
}

/**
 * BlurHash crop, method 1 — resample: evaluate the hash's cosine series over the crop
 * window at a small sample grid, then standard-encode those samples as a fresh hash.
 * The "decode → crop pixels → re-encode" pipeline, minus ever materializing an image:
 * both halves run on the tiny sample grid. Matches what stock blurhash tooling would
 * produce (including its quirky both-axes-AC normalization).
 */
import { decodeToLinearGrid, encodeCoefficients, encodeLinearGrid, parseBlurhash } from './codec'
import type { CropWindow } from './window'

export interface CropResampleOptions {
  /** Output components. Default: same as the source hash. */
  cx?: number
  cy?: number
  /** Sample grid used for the round-trip. Default 32×32 — plenty above Nyquist for ≤9 components. */
  samples?: number
  /** Stock wolt encode norms instead of round-trip-exact orthogonal ones — see EncodeGridOptions. Default false. */
  stockNorms?: boolean
}

export const cropBlurhashResample = (hash: string, window: CropWindow, opts: CropResampleOptions = {}): string => {
  const parsed = parseBlurhash(hash)
  const samples = opts.samples ?? 32
  const grid = decodeToLinearGrid(parsed, samples, samples, window)
  return encodeCoefficients(encodeLinearGrid(grid, opts.cx ?? parsed.cx, opts.cy ?? parsed.cy, { orthonormal: !opts.stockNorms }))
}

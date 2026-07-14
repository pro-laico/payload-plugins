import type { CropResampleOptions, CropWindow } from '../../types'
import { decodeToLinearGrid, encodeCoefficients, encodeLinearGrid, parseBlurhash } from './codec'

export const cropBlurhashResample = (hash: string, window: CropWindow, opts: CropResampleOptions = {}): string => {
  const parsed = parseBlurhash(hash)
  const samples = opts.samples ?? 32
  const grid = decodeToLinearGrid(parsed, samples, samples, window)
  return encodeCoefficients(encodeLinearGrid(grid, opts.cx ?? parsed.cx, opts.cy ?? parsed.cy, { orthonormal: !opts.stockNorms }))
}

import { describe, expect, it } from 'vitest'

import { decodeToLinearGrid, encodeCoefficients, encodeLinearGrid, linearToSrgb, parseBlurhash } from '../../../src/lib/placeholders/codec'
import type { CropWindow, LinearGrid } from '../../../src/types'
import { cropBlurhashCoefficients } from '../../../src/lib/placeholders/cropCoefficients'
import { cropBlurhashResample } from '../../../src/lib/placeholders/cropResample'
import { coverCropWindow } from '../../../src/lib/placeholders/window'

const syntheticGrid = (width: number, height: number): LinearGrid =>
  Array.from({ length: height }, (_, t) =>
    Array.from({ length: width }, (_, s) => {
      const x = (s + 0.5) / width
      const y = (t + 0.5) / height
      const blob = (cx: number, cy: number, r: number): number => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r))
      const sky = 0.55 * (1 - y)
      const sun = blob(0.72, 0.28, 0.12)
      const bush = blob(0.25, 0.8, 0.18)
      return [
        Math.min(1, 0.15 + sky * 0.6 + sun * 0.75 + bush * 0.05),
        Math.min(1, 0.18 + sky * 0.75 + sun * 0.55 + bush * 0.45),
        Math.min(1, 0.25 + sky * 0.95 + sun * 0.2 + bush * 0.1),
      ]
    }),
  )

const rmseSrgb = (a: LinearGrid, b: LinearGrid): number => {
  let sum = 0
  let n = 0
  for (let t = 0; t < a.length; t++)
    for (let s = 0; s < a[0]!.length; s++)
      for (let ch = 0; ch < 3; ch++) {
        const d = linearToSrgb(a[t]![s]![ch]!) - linearToSrgb(b[t]![s]![ch]!)
        sum += d * d
        n++
      }
  return Math.sqrt(sum / n)
}

const N = 24 // comparison raster
const original = encodeCoefficients(encodeLinearGrid(syntheticGrid(64, 48), 9, 9))

const WINDOWS: Record<string, CropWindow> = {
  'identity (sanity)': { x0: 0, y0: 0, w: 1, h: 1 },
  '16:9 of 4:3, centered': coverCropWindow(4 / 3, 16 / 9),
  'square, focal 70/35': coverCropWindow(4 / 3, 1, 70, 35),
  'tight 25% window': { x0: 0.4, y0: 0.4, w: 0.25, h: 0.25 },
}

describe('blurhash crop: resample vs coefficient projection', () => {
  const rows: Record<string, Record<string, string | number>> = {}

  for (const [name, window] of Object.entries(WINDOWS)) {
    it(`stays close to the exact restricted blur — ${name}`, () => {
      const reference = decodeToLinearGrid(parseBlurhash(original), N, N, window)
      const m1stock = cropBlurhashResample(original, window, { stockNorms: true })
      const m1 = cropBlurhashResample(original, window)
      const m2 = cropBlurhashCoefficients(original, window)
      const err = (hash: string): number => rmseSrgb(decodeToLinearGrid(parseBlurhash(hash), N, N), reference)
      const e1stock = err(m1stock)
      const e1 = err(m1)
      const e2 = err(m2)
      const cross = rmseSrgb(decodeToLinearGrid(parseBlurhash(m1), N, N), decodeToLinearGrid(parseBlurhash(m2), N, N))
      rows[name] = {
        'm1 stock-norm': e1stock.toFixed(2),
        'm1 orthonorm': e1.toFixed(2),
        'm2 projection': e2.toFixed(2),
        'm1 vs m2': cross.toFixed(2),
      }

      // Placeholder-blur tolerance: a handful of sRGB steps. Identity should be near-lossless
      // for the exact variants; stock norms halve diagonal AC terms (reported, not asserted).
      const limit = name.startsWith('identity') ? 3 : 14
      expect(e1).toBeLessThan(limit)
      expect(e2).toBeLessThan(limit)
    })
  }

  it('reports timings (µs/op)', () => {
    const window = WINDOWS['16:9 of 4:3, centered']!
    const time = (fn: () => void, iters: number): number => {
      for (let i = 0; i < 200; i++) fn() // warm
      const t0 = process.hrtime.bigint()
      for (let i = 0; i < iters; i++) fn()
      return Number(process.hrtime.bigint() - t0) / 1000 / iters
    }
    const t1 = time(() => cropBlurhashResample(original, window), 2_000)
    const t2 = time(() => cropBlurhashCoefficients(original, window), 2_000)
    const tParse = time(() => parseBlurhash(original), 5_000)

    console.log('\n=== blurhash crop comparison (9x9 source) ===')
    console.table(rows)
    console.table({
      'method 1: resample (32x32)': { 'µs/op': t1.toFixed(1), 'ops/sec': Math.round(1_000_000 / t1).toLocaleString() },
      'method 2: coefficient projection': { 'µs/op': t2.toFixed(1), 'ops/sec': Math.round(1_000_000 / t2).toLocaleString() },
      'parse only (shared cost)': { 'µs/op': tParse.toFixed(1), 'ops/sec': Math.round(1_000_000 / tParse).toLocaleString() },
    })

    expect(t1).toBeLessThan(5_000) // both must be sub-5ms even on a slow CI box
    expect(t2).toBeLessThan(5_000)
  })
})

describe('spec format', () => {
  it('encodes byte-identical spec strings and rejects components beyond 9×9', () => {
    const hash = encodeCoefficients(encodeLinearGrid(syntheticGrid(32, 32), 4, 3))
    expect(hash.length).toBe(4 + 2 * 4 * 3)
    expect(parseBlurhash(hash).cx).toBe(4)
    expect(() => encodeCoefficients(encodeLinearGrid(syntheticGrid(32, 32), 10, 10))).toThrow(/out of range/)
  })
})

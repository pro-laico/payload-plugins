import type { AspectRatio } from '../../../types'

// Cover crops round one dimension (h = w / ar), so the exact reduction of a variant's stored
// pixels rarely lands back on the intended pair (800×533 reduces to 800:533, not 3:2) — snap to
// the common ratios first, then fall back to a clean exact reduction, else a decimal.
const COMMON_RATIOS: [number, number][] = [
  [1, 1],
  [5, 4],
  [4, 3],
  [3, 2],
  [8, 5],
  [5, 3],
  [16, 9],
  [2, 1],
  [21, 9],
  [3, 1],
]
const SNAP_TOLERANCE = 0.015

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Display ratio derived from a variant's actual pixel dimensions. */
export const ratioLabel = (w?: number, h?: number): AspectRatio | undefined => {
  if (!w || !h) return undefined
  const r = w / h
  for (const [a, b] of COMMON_RATIOS) {
    if (Math.abs((r * b) / a - 1) < SNAP_TOLERANCE) return `${a}:${b}`
    if (Math.abs((b / r) * (1 / a) - 1) < SNAP_TOLERANCE) return `${b}:${a}`
  }
  const g = gcd(w, h)
  if (w / g <= 50 && h / g <= 50) return `${w / g}:${h / g}`
  return Math.round(r * 100) / 100
}

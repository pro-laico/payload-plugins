import { stepWidths } from '../urls/srcset'
import type { PrewarmWidths, TransformConstraints } from '../../types'

/** Every width the endpoint's snap can emit: multiples of `dimensionStep` up to `maxDimension`,
 * `maxDimension` itself (the clamp target), unioned with the width ladder — ascending, deduped. */
export const reachableWidths = (c: TransformConstraints): number[] => {
  const widths = new Set<number>()
  for (let w = c.dimensionStep; w < c.maxDimension; w += c.dimensionStep) widths.add(w)
  widths.add(c.maxDimension)
  for (const w of c.widthLadder ?? []) if (w > 0 && w <= c.maxDimension) widths.add(Math.round(w))
  return [...widths].sort((a, b) => a - b)
}

/** Resolve a strategy's width axis for one source. Stride samples descend from the largest
 * reachable width the source supports, then flip back to ascending — so the top width (the
 * LCP render) always survives the sampling. */
export const deriveStrategyWidths = (widths: PrewarmWidths, sourceWidth: number | undefined, c: TransformConstraints): number[] => {
  if (Array.isArray(widths)) return widths
  if (widths === 'srcset') return stepWidths(sourceWidth, c.widthLadder ?? c.dimensionStep, c.maxDimension)
  const every = Math.max(1, Math.floor(widths.every))
  const cap = Math.min(sourceWidth ?? c.maxDimension, c.maxDimension)
  const reachable = reachableWidths(c).filter((w) => w <= cap)
  return reachable.filter((_, i) => (reachable.length - 1 - i) % every === 0)
}

import { parseTransformParams } from './params'
import type { FallbackCandidate, OutputFormat, ParsedParams, TransformConstraints } from '../../types'

export const FALLBACK_MIN_WIDTH_RATIO = 0.5

const replayHeight = (w: number, ratio: number, constraints: TransformConstraints): number | undefined => {
  const parsed = parseTransformParams({ w: String(w), ar: String(ratio) }, constraints)
  return parsed.ok ? parsed.params.h : undefined
}

export const pickFallbackVariant = (
  p: ParsedParams,
  format: OutputFormat,
  source: { width?: number | null; height?: number | null; focalX?: number | null; focalY?: number | null },
  candidates: FallbackCandidate[],
  constraints: TransformConstraints,
): FallbackCandidate | null => {
  if (p.w == null) return null
  const reqRatio = p.h != null ? p.w / p.h : source.width && source.height && source.height > 0 ? source.width / source.height : null
  if (reqRatio == null || reqRatio <= 0) return null

  const effectiveW = Math.min(p.w, source.width && source.width > 0 ? source.width : p.w)
  const srcFocalX = source.focalX ?? 50
  const srcFocalY = source.focalY ?? 50
  const sameFocal = (c: FallbackCandidate): boolean =>
    Math.abs((c.focalX ?? 50) - srcFocalX) <= 1 && Math.abs((c.focalY ?? 50) - srcFocalY) <= 1

  const qualifies = (c: FallbackCandidate): boolean => {
    if (!c.width || !c.height || c.width <= 0 || c.height <= 0) return false
    if ((c.fit ?? 'cover') !== p.fit) return false
    if (c.format === 'avif' && format !== 'avif') return false
    if (!sameFocal(c)) return false
    if (c.width < FALLBACK_MIN_WIDTH_RATIO * effectiveW) return false
    if (replayHeight(c.width, reqRatio, constraints) === c.height) return true
    if (p.h != null && p.w != null && replayHeight(p.w, c.width / c.height, constraints) === p.h) return true
    return Math.abs(c.height - c.width / reqRatio) <= 1
  }

  const pool = candidates.filter(qualifies)
  if (!pool.length) return null

  const score = (c: FallbackCandidate): [number, number, number, number] => [
    (c.width ?? 0) >= effectiveW ? 0 : 1,
    (c.width ?? 0) >= effectiveW ? (c.width ?? 0) : -(c.width ?? 0),
    Math.abs((c.quality ?? p.q) - p.q),
    c.format === format ? 0 : 1,
  ]
  return pool.reduce((best, c) => {
    const a = score(c)
    const b = score(best)
    for (let i = 0; i < a.length; i++) {
      if (a[i]! < b[i]!) return c
      if (a[i]! > b[i]!) return best
    }
    return best
  })
}

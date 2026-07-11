/**
 * The nearby-fallback picker: on a cache miss, choose an already-generated variant that can stand
 * in for the requested render — SAME fit and SAME aspect ratio (identical crop; only fidelity may
 * differ, briefly) — so the visitor never waits on a cold transform. Pure; the endpoint serves the
 * pick with `Cache-Control: no-store` while the exact variant generates in the background.
 *
 * Geometry matching is exact, not epsilon-based. Stored dims are ACTUAL Sharp output — snapped for
 * two-dimension requests, off-grid for width-only ones (derived height, e.g. 800×533) and for
 * no-upscale clamps — and snap distortion is asymmetric across widths. So a candidate matches when
 * ANY of these reproduce it:
 *   A. replaying the request's ratio at the candidate's width through `parseTransformParams`
 *      yields the candidate's height;
 *   B. replaying the candidate's own ratio at the request's width yields the request's height;
 *   C. the candidate's height is within 1px of `width / requestRatio` (Sharp's ratio math).
 */
import { parseTransformParams } from './params'
import type { FallbackCandidate, OutputFormat, ParsedParams, TransformConstraints } from '../../types'

/** Candidates narrower than this fraction of the (source-clamped) requested width are too blurry to stand in. */
export const FALLBACK_MIN_WIDTH_RATIO = 0.5

const replayHeight = (w: number, ratio: number, constraints: TransformConstraints): number | undefined => {
  const parsed = parseTransformParams({ w: String(w), ar: String(ratio) }, constraints)
  return parsed.ok ? parsed.params.h : undefined
}

export const pickFallbackVariant = (
  p: ParsedParams,
  format: OutputFormat,
  source: { width?: number | null; height?: number | null },
  candidates: FallbackCandidate[],
  constraints: TransformConstraints,
): FallbackCandidate | null => {
  if (p.w == null) return null // height-only requests have no width anchor — generate inline
  const reqRatio = p.h != null ? p.w / p.h : source.width && source.height && source.height > 0 ? source.width / source.height : null
  if (reqRatio == null || reqRatio <= 0) return null

  const effectiveW = Math.min(p.w, source.width && source.width > 0 ? source.width : p.w)

  const qualifies = (c: FallbackCandidate): boolean => {
    if (!c.width || !c.height || c.width <= 0 || c.height <= 0) return false
    if ((c.fit ?? 'cover') !== p.fit) return false
    if (c.format === 'avif' && format !== 'avif') return false // the client may not decode avif
    if (c.width < FALLBACK_MIN_WIDTH_RATIO * effectiveW) return false
    if (replayHeight(c.width, reqRatio, constraints) === c.height) return true
    if (p.h != null && p.w != null && replayHeight(p.w, c.width / c.height, constraints) === p.h) return true
    return Math.abs(c.height - c.width / reqRatio) <= 1
  }

  const pool = candidates.filter(qualifies)
  if (!pool.length) return null

  // Smallest sufficient width beats everything; below-target falls back to the largest available.
  // Ties: closest quality, then the negotiated format.
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

import { parseTransformParams } from './params'
import { cropRegion, fitWithinSource, hotspotWindow } from './geometry'
import type { FallbackCandidate, FallbackSource, OutputFormat, ParsedParams, TransformConstraints } from '../../types'

export const FALLBACK_MIN_WIDTH_RATIO = 0.5
// Snapping loses the requested ratio's last ~10%, so candidates are gated by relative ratio drift:
// past MAX_RATIO_DRIFT a candidate is a different crop family and never stands in; within it,
// candidates closer than RATIO_SCORE_DRIFT count as the same family and rank on width/quality/format.
export const FALLBACK_MAX_RATIO_DRIFT = 0.08
const RATIO_SCORE_DRIFT = 0.03

const replayHeight = (w: number, ratio: number, constraints: TransformConstraints): number | undefined => {
  const parsed = parseTransformParams({ w: String(w), ar: String(ratio) }, constraints)
  return parsed.ok ? parsed.params.h : undefined
}

const hotspotOf = (source: FallbackSource) => ({
  focalX: source.focalX,
  focalY: source.focalY,
  focalSize: source.focalSize,
  cropLeft: source.cropLeft,
  cropTop: source.cropTop,
  cropRight: source.cropRight,
  cropBottom: source.cropBottom,
})

/** The widest render the transform can actually produce for this request — the request width clamped
 * by the no-upscale fit against the hotspot/crop window (not the raw source width). Anchors both the
 * fallback width floor and the endpoint's candidate-query floor. */
export const effectiveRequestWidth = (p: ParsedParams, source: FallbackSource): number => {
  if (p.w == null) return 0
  const sw = source.width && source.width > 0 ? source.width : 0
  const sh = source.height && source.height > 0 ? source.height : 0
  if (!sw || !sh) return p.w
  if (p.fit === 'cover' && p.h != null) {
    const win = hotspotWindow(sw, sh, p.w / p.h, hotspotOf(source))
    return Math.min(p.w, fitWithinSource(p.w, p.h, win.w, win.h).w)
  }
  const region = cropRegion(sw, sh, hotspotOf(source))
  return Math.min(p.w, Math.max(1, Math.round(region.w)))
}

export const pickFallbackVariant = (
  p: ParsedParams,
  format: OutputFormat,
  source: FallbackSource,
  candidates: FallbackCandidate[],
  constraints: TransformConstraints,
): FallbackCandidate | null => {
  if (p.w == null) return null
  const reqRatio = p.h != null ? p.w / p.h : source.width && source.height && source.height > 0 ? source.width / source.height : null
  if (reqRatio == null || reqRatio <= 0) return null

  const effectiveW = effectiveRequestWidth(p, source)
  const srcFocalX = source.focalX ?? 50
  const srcFocalY = source.focalY ?? 50
  const sameFocal = (c: FallbackCandidate): boolean =>
    Math.abs((c.focalX ?? 50) - srcFocalX) <= 1 && Math.abs((c.focalY ?? 50) - srcFocalY) <= 1
  // A zoomed hotspot (focalSize < 100) renders different CONTENT for windowed (w+h cover) vs
  // full-frame (width-only) requests at identical dims, so the persisted render path must match.
  const zoomed = p.fit === 'cover' && source.focalSize != null && source.focalSize < 100
  const requestWindowed = p.fit === 'cover' && p.h != null

  const qualifies = (c: FallbackCandidate): boolean => {
    if (!c.width || !c.height || c.width <= 0 || c.height <= 0) return false
    if ((c.fit ?? 'cover') !== p.fit) return false
    if (c.format === 'avif' && format !== 'avif') return false
    // Never serve a format the client didn't prove it decodes: webp only on webp-or-better negotiation.
    if (c.format === 'webp' && format !== 'webp' && format !== 'avif') return false
    if (!sameFocal(c)) return false
    if (zoomed && (c.windowed == null || c.windowed !== requestWindowed)) return false
    if (c.width < FALLBACK_MIN_WIDTH_RATIO * effectiveW) return false
    if (Math.abs(c.width / c.height - reqRatio) / reqRatio > FALLBACK_MAX_RATIO_DRIFT) return false
    if (replayHeight(c.width, reqRatio, constraints) === c.height) return true
    if (p.h != null && p.w != null && replayHeight(p.w, c.width / c.height, constraints) === p.h) return true
    return Math.abs(c.height - c.width / reqRatio) <= 1
  }

  const pool = candidates.filter(qualifies)
  if (!pool.length) return null

  const score = (c: FallbackCandidate): [number, number, number, number, number] => [
    Math.abs((c.width ?? 1) / (c.height ?? 1) - reqRatio) / reqRatio <= RATIO_SCORE_DRIFT ? 0 : 1,
    (c.width ?? 0) >= effectiveW ? 0 : 1,
    (c.width ?? 0) >= effectiveW ? (c.width ?? 0) : -(c.width ?? 0),
    c.format === 'png' ? 0 : Math.abs((c.quality ?? p.q) - p.q),
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

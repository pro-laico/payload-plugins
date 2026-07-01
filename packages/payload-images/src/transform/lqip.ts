/**
 * Pure LQIP size/quality resolution — no Sharp, no Payload, safe to unit-test in isolation.
 *
 * Trust split: the component (the developer's own JSX) *honors* a requested width up to an absolute
 * typo guard — its feedback is a dev warning, not a silent cap. The external `context.lqip` door is
 * untrusted, so it *clamps* to the project `maxWidth` and snaps to a /8 grid (bounding the variant
 * space the way the endpoint's `dimensionStep` does). Both clamp quality to a small LQIP range.
 */

export const LQIP_MIN_WIDTH = 8
/** Absolute typo guard for the trusted (component) path — honored up to here, never beyond. */
export const LQIP_HARD_MAX_WIDTH = 256
/** Quality clamp — LQIPs gain nothing from high quality, and a small range bounds the variant space. */
export const LQIP_QUALITY_RANGE: [number, number] = [20, 70]

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))
const positive = (n: number | undefined): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined)

/**
 * Resolve the LQIP width. `untrusted` (the external door) clamps to `[MIN, maxWidth]` and snaps to
 * a /8 grid. Trusted (the component) honors the request up to {@link LQIP_HARD_MAX_WIDTH}.
 */
export const resolveLqipWidth = (requested: number | undefined, defaultW: number, maxWidth: number, untrusted: boolean): number => {
  const w = Math.round(positive(requested) ?? defaultW)
  if (untrusted) {
    const cap = Math.max(LQIP_MIN_WIDTH, Math.round(maxWidth))
    return Math.max(LQIP_MIN_WIDTH, Math.round(clamp(w, LQIP_MIN_WIDTH, cap) / 8) * 8)
  }
  return clamp(w, LQIP_MIN_WIDTH, LQIP_HARD_MAX_WIDTH)
}

/** Clamp a requested LQIP quality to {@link LQIP_QUALITY_RANGE}, falling back to `defaultQ`. */
export const clampLqipQuality = (requested: number | undefined, defaultQ: number): number =>
  clamp(Math.round(positive(requested) ?? defaultQ), LQIP_QUALITY_RANGE[0], LQIP_QUALITY_RANGE[1])

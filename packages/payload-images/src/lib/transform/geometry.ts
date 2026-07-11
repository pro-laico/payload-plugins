/**
 * Pure hotspot/crop geometry — isomorphic on purpose: the transform endpoint (server), the
 * blurhash coefficient crop, and the admin focal preview (client) all import it, so what the
 * author sets against the preview is exactly what the endpoint renders. Three stored,
 * non-destructive layers compose into one crop window (Sanity's model): edge-trim **crop**,
 * the **focal point** windows center on, and **focal size** (hotspot diameter as % of the crop
 * region's shorter side — 100 keeps the maximal window, smaller zooms in).
 */
import type { CropGeometry, CropWindowRect, HotspotOpts } from '../../types'

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

const pct = (v: number | null | undefined, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** The usable region after edge trims, in source px. Each side clamped so ≥10% survives. */
export const cropRegion = (sw: number, sh: number, o: HotspotOpts = {}): CropWindowRect => {
  const l = clamp(pct(o.cropLeft, 0), 0, 90) / 100
  const t = clamp(pct(o.cropTop, 0), 0, 90) / 100
  const r = clamp(pct(o.cropRight, 0), 0, 90) / 100
  const b = clamp(pct(o.cropBottom, 0), 0, 90) / 100
  const w = Math.max(sw * 0.1, sw * (1 - l - r))
  const h = Math.max(sh * 0.1, sh * (1 - t - b))
  return { x: Math.min(sw * l, sw - w), y: Math.min(sh * t, sh - h), w, h }
}

/**
 * The cover-crop window for a target aspect ratio: the smallest rect at that ratio containing
 * the hotspot circle, grown/clamped to the crop region and centered on the focal point (drifting
 * only at the region's edges). `focalSize: 100` reproduces plain focal-cover cropping.
 */
export const hotspotWindow = (sw: number, sh: number, targetAr: number, o: HotspotOpts = {}): CropWindowRect => {
  const region = cropRegion(sw, sh, o)
  const a = targetAr > 0 ? targetAr : 1

  const d = (clamp(pct(o.focalSize, 100), 5, 100) / 100) * Math.min(region.w, region.h)
  let w = a >= 1 ? d * a : d
  let h = w / a
  const s = Math.min(1, region.w / w, region.h / h)
  w *= s
  h *= s

  const fx = clamp((clamp(pct(o.focalX, 50), 0, 100) / 100) * sw, region.x, region.x + region.w)
  const fy = clamp((clamp(pct(o.focalY, 50), 0, 100) / 100) * sh, region.y, region.y + region.h)
  return {
    x: clamp(fx - w / 2, region.x, region.x + region.w - w),
    y: clamp(fy - h / 2, region.y, region.y + region.h - h),
    w,
    h,
  }
}

/** {@link hotspotWindow} as fractions of the source (dims-free) — the blurhash coefficient crop's input. */
export const hotspotWindowFractions = (sourceAr: number, targetAr: number, o: HotspotOpts = {}): CropWindowRect => {
  const sw = sourceAr > 0 ? sourceAr : 1
  const win = hotspotWindow(sw, 1, targetAr, o)
  return { x: win.x / sw, y: win.y, w: win.w / sw, h: win.h }
}

/**
 * Cover-crop geometry honoring the hotspot layers, from (orientation-corrected) source dims and
 * a target box (a missing side is derived from the source aspect; both missing falls back to the
 * source dims). Default opts reproduce the plain focal cover-crop exactly.
 */
export const coverCropGeometry = (
  sw: number,
  sh: number,
  targetW: number | undefined,
  targetH: number | undefined,
  focalX = 50,
  focalY = 50,
  opts: HotspotOpts = {},
): CropGeometry => {
  const tw = targetW ?? Math.max(1, Math.round(((targetH ?? sh) * sw) / sh))
  const th = targetH ?? Math.max(1, Math.round(((targetW ?? sw) * sh) / sw))
  const o: HotspotOpts = { ...opts, focalX: opts.focalX ?? focalX, focalY: opts.focalY ?? focalY }
  const win = hotspotWindow(sw, sh, tw / th, o)

  const scale = tw / win.w
  const resizeWidth = Math.max(tw, Math.round(sw * scale))
  const resizeHeight = Math.max(th, Math.round(sh * scale))
  const region = cropRegion(sw, sh, o)
  const x0 = Math.round((region.x / sw) * resizeWidth)
  const x1 = Math.min(resizeWidth, Math.round(((region.x + region.w) / sw) * resizeWidth))
  const y0 = Math.round((region.y / sh) * resizeHeight)
  const y1 = Math.min(resizeHeight, Math.round(((region.y + region.h) / sh) * resizeHeight))
  const fx = clamp((clamp(pct(o.focalX, 50), 0, 100) / 100) * resizeWidth, x0, x1)
  const fy = clamp((clamp(pct(o.focalY, 50), 0, 100) / 100) * resizeHeight, y0, y1)
  const left = clamp(Math.round(fx - tw / 2), x0, Math.max(x0, x1 - tw))
  const top = clamp(Math.round(fy - th / 2), y0, Math.max(y0, y1 - th))
  return { resizeWidth, resizeHeight, left, top, width: tw, height: th }
}

/** No-upscale clamp: shrink a target box to fit within the source, preserving its aspect ratio —
 *  an oversized request renders at the source's resolution instead of being enlarged. */
export const fitWithinSource = (tw: number, th: number, sw: number, sh: number): { w: number; h: number } => {
  const f = Math.min(1, sw / tw, sh / th)
  return { w: Math.max(1, Math.round(tw * f)), h: Math.max(1, Math.round(th * f)) }
}

/**
 * The CSS placement that reproduces {@link hotspotWindow} inside a preview tile whose aspect
 * ratio equals the window's: percentages for an absolutely-positioned `<img>`. Handles zoom and
 * crop, which plain `object-position` cannot express.
 */
export const windowCss = (sw: number, sh: number, targetAr: number, o: HotspotOpts = {}): { left: number; top: number; width: number } => {
  const win = hotspotWindow(sw, sh, targetAr, o)
  return { left: (-win.x / win.w) * 100, top: (-win.y / win.h) * 100, width: (sw / win.w) * 100 }
}

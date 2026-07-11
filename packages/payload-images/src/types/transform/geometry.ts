/** Pure hotspot/crop geometry types — the stored crop layers and the derived windows. */

/** The hotspot/crop inputs, all optional — defaults reproduce plain focal-cover behavior. */
export interface HotspotOpts {
  /** Focal percentages (0–100). Default 50/50. */
  focalX?: number | null
  focalY?: number | null
  /** Hotspot circle diameter, % of the crop region's shorter side (5–100). Default 100. */
  focalSize?: number | null
  /** Edge trims, % of the full image removed per side (0–90). Default 0. */
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

/** A crop window in source pixels (or fractions, from {@link hotspotWindowFractions}). */
export interface CropWindowRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CropGeometry {
  /** Resize the source to these dims first (preserves aspect, covers the target). */
  resizeWidth: number
  resizeHeight: number
  /** Then extract this window. */
  left: number
  top: number
  width: number
  height: number
}

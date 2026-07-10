/** A crop window on the unit square (fractions of the source, not pixels). */
import { type HotspotOpts, hotspotWindowFractions } from '../transform/geometry'

export interface CropWindow {
  x0: number
  y0: number
  w: number
  h: number
}

/**
 * The cover-crop window for a target aspect ratio — the blurhash-space twin of the
 * endpoint's `hotspotWindow`: the same crop/focal/focal-size composition, as unit-square
 * fractions, so a cropped hash shows exactly the region the rendered image will.
 */
export const coverCropWindow = (sourceAr: number, targetAr: number, focalX = 50, focalY = 50, opts: HotspotOpts = {}): CropWindow => {
  const win = hotspotWindowFractions(sourceAr, targetAr, { ...opts, focalX: opts.focalX ?? focalX, focalY: opts.focalY ?? focalY })
  return { x0: win.x, y0: win.y, w: win.w, h: win.h }
}

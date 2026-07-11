import { hotspotWindowFractions } from '../transform/geometry'
import type { CropWindow, HotspotOpts } from '../../types'

/**
 * The cover-crop window for a target aspect ratio — the blurhash-space twin of the endpoint's
 * `hotspotWindow`, so a cropped placeholder shows exactly the region the rendered image will.
 */
export const coverCropWindow = (sourceAr: number, targetAr: number, focalX = 50, focalY = 50, opts: HotspotOpts = {}): CropWindow => {
  const win = hotspotWindowFractions(sourceAr, targetAr, { ...opts, focalX: opts.focalX ?? focalX, focalY: opts.focalY ?? focalY })
  return { x0: win.x, y0: win.y, w: win.w, h: win.h }
}

/**
 * Server-only Sharp transform. `sharp` is a lazy import so the package carries no
 * hard runtime dependency (it's an optional peer) and so client bundles never pull
 * it in. The focal-crop geometry is split out as a pure function for unit testing.
 */
import type { Sharp } from 'sharp'

import { loadSharp } from './sharpInstance'
import { withTransformLimit } from './limit'
import { type Fit, mimeForFormat, type OutputFormat } from './params'
import { coverCropGeometry, cropRegion, fitWithinSource, type HotspotOpts, hotspotWindow } from './geometry'

export { coverCropGeometry, coverObjectPosition, fitWithinSource } from './geometry'
export type { CropGeometry } from './geometry'

export interface TransformInput {
  w?: number
  h?: number
  fit: Fit
  quality: number
  format: OutputFormat
  focalX?: number | null
  focalY?: number | null
  /** Hotspot zoom + non-destructive crop layers (see transform/geometry.ts). */
  hotspot?: HotspotOpts
  /** Max source pixels Sharp will decode (decompression-bomb + memory guard). Defaults to {@link MAX_INPUT_PIXELS}. */
  maxInputPixels?: number
}

export interface TransformOutput {
  data: Buffer
  format: OutputFormat
  width: number
  height: number
  mimeType: string
}

/** Default decompression-bomb / memory guard (~100MP); overridable per call via {@link TransformInput.maxInputPixels}. */
const MAX_INPUT_PIXELS = 100_000_000

const encode = (pipeline: Sharp, format: OutputFormat, quality: number): Sharp => {
  switch (format) {
    case 'avif':
      return pipeline.avif({ quality })
    case 'webp':
      return pipeline.webp({ quality })
    case 'png':
      return pipeline.png()
    default:
      return pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
  }
}

/**
 * Transform a source image buffer: focal cover-crop (or plain resize for other fits) +
 * encode. The CPU-bound work runs behind {@link withTransformLimit} so a burst of
 * concurrent srcset requests can't saturate the host.
 */
export const transformImage = (src: Buffer, input: TransformInput): Promise<TransformOutput> =>
  withTransformLimit(async () => {
    const sharp = await loadSharp()
    let pipeline = sharp(src, { failOn: 'none', limitInputPixels: input.maxInputPixels ?? MAX_INPUT_PIXELS }).rotate()
    const meta = await pipeline.metadata()
    const swapped = (meta.orientation ?? 1) >= 5
    const sw = (swapped ? meta.height : meta.width) ?? 0
    const sh = (swapped ? meta.width : meta.height) ?? 0

    const hotspot: HotspotOpts = {
      ...input.hotspot,
      focalX: input.focalX ?? input.hotspot?.focalX,
      focalY: input.focalY ?? input.hotspot?.focalY,
    }
    if (input.fit === 'cover' && input.w != null && input.h != null && sw > 0 && sh > 0) {
      const win = hotspotWindow(sw, sh, input.w / input.h, hotspot)
      const { w: tw, h: th } = fitWithinSource(input.w, input.h, win.w, win.h)
      const g = coverCropGeometry(sw, sh, tw, th, input.focalX ?? 50, input.focalY ?? 50, hotspot)
      pipeline = pipeline.resize(g.resizeWidth, g.resizeHeight).extract({ left: g.left, top: g.top, width: g.width, height: g.height })
    } else {
      const region = cropRegion(sw, sh, hotspot)
      if (sw > 0 && sh > 0 && (region.w < sw || region.h < sh)) {
        pipeline = pipeline.extract({
          left: Math.round(region.x),
          top: Math.round(region.y),
          width: Math.max(1, Math.round(region.w)),
          height: Math.max(1, Math.round(region.h)),
        })
      }
      pipeline = pipeline.resize({
        width: input.w,
        height: input.h,
        fit: input.fit,
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
    }

    const { data, info } = await encode(pipeline, input.format, input.quality).toBuffer({ resolveWithObject: true })
    return { data, format: input.format, width: info.width, height: info.height, mimeType: mimeForFormat(input.format) }
  })

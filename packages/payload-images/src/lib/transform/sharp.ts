import type { Sharp } from 'sharp'

import { mimeForFormat } from './params'
import { withTransformLimit } from './limit'
import { loadSharp } from './sharpInstance'
import { coverCropGeometry, cropRegion, fitWithinSource, hotspotWindow } from './geometry'
import type { HotspotOpts, OutputFormat, TransformInput, TransformOutput } from '../../types'

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

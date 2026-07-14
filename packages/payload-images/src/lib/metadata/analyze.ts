import type { Sharp } from 'sharp'

import { buildPalette } from './palette'
import { loadSharp } from '../transform/sharpInstance'
import type { ImageMetadataAnalysis, LinearGrid } from '../../types'
import { encodeWebpPlaceholder } from '../placeholders/webpPlaceholder'
import { encodeCoefficients, encodeLinearGrid, srgbToLinear } from '../placeholders/codec'
import { BLURHASH_QUALITIES, BLURHASH_TIERS, blurhashFieldName, WEBP_QUALITIES, WEBP_TIERS, webpFieldName } from '../placeholders/qualities'

const SAMPLE_EDGE = 64

export const analyzeImageMetadata = async (file: Buffer): Promise<ImageMetadataAnalysis> => {
  const sharp = await loadSharp()
  const base = sharp(file, { failOn: 'none' }).rotate()
  const meta = await base.metadata()
  const { data: raw, info } = await base
    .clone()
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minAlpha = 255
  const grid: LinearGrid = []
  for (let t = 0; t < info.height; t++) {
    const row: [number, number, number][] = []
    for (let s = 0; s < info.width; s++) {
      const o = (t * info.width + s) * 4
      row.push([srgbToLinear(raw[o]!), srgbToLinear(raw[o + 1]!), srgbToLinear(raw[o + 2]!)])
      if (raw[o + 3]! < minAlpha) minAlpha = raw[o + 3]!
    }
    grid.push(row)
  }

  const placeholderFields: Record<string, string> = {}
  for (const quality of BLURHASH_TIERS) {
    const [cx, cy] = BLURHASH_QUALITIES[quality]
    placeholderFields[blurhashFieldName(quality)] = encodeCoefficients(encodeLinearGrid(grid, cx, cy))
  }
  for (const quality of WEBP_TIERS) placeholderFields[webpFieldName(quality)] = await encodeWebpPlaceholder(base, WEBP_QUALITIES[quality])

  return {
    placeholderFields,
    palette: buildPalette(grid),
    hasAlpha: meta.hasAlpha === true,
    isOpaque: minAlpha >= 250,
    attention: await attentionFocal(base.clone(), sourceDims(meta)),
  }
}

const attentionFocal = async (pipeline: Sharp, dims: { w: number; h: number } | undefined): Promise<{ x: number; y: number } | undefined> => {
  if (!dims) return undefined
  const probe = async (tw: number, th: number): Promise<{ x: number; y: number } | undefined> => {
    const { info } = await pipeline.clone().resize(tw, th, { fit: 'cover', position: 'attention' }).toBuffer({ resolveWithObject: true })
    const { attentionX, attentionY } = info
    if (typeof attentionX !== 'number' || typeof attentionY !== 'number') return undefined
    const scale = Math.max(tw / dims.w, th / dims.h)
    const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 10) / 10))
    return { x: clamp((attentionX / (dims.w * scale)) * 100), y: clamp((attentionY / (dims.h * scale)) * 100) }
  }
  try {
    return (await probe(SAMPLE_EDGE, 8)) ?? (await probe(8, SAMPLE_EDGE))
  } catch {
    return undefined
  }
}

const sourceDims = (meta: { width?: number; height?: number; orientation?: number }): { w: number; h: number } | undefined => {
  if (!meta.width || !meta.height) return undefined
  const swapped = (meta.orientation ?? 1) >= 5
  return swapped ? { w: meta.height, h: meta.width } : { w: meta.width, h: meta.height }
}

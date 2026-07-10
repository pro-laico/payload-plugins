/**
 * Server-side image metadata analysis from image bytes — the ONE place pixels meet
 * metadata. A single Sharp decode to a tiny raw grid feeds everything derived from it:
 *
 *  - the placeholder tiers (five blurhash strings + the micro-webp data URIs), keyed by
 *    their stored field names
 *  - the Sanity-style color palette
 *  - `hasAlpha` / `isOpaque`
 *  - an attention-based focal point suggestion (Sharp's saliency crop), used as the
 *    initial focal when the editor hasn't chosen one
 *
 * Shared by the upload hook (new files) and the `payload images:backfill` command
 * (docs that predate the hook).
 */
import type { Sharp } from 'sharp'

import { loadSharp } from '../transform/sharpInstance'
import { encodeWebpPlaceholder } from './webpPlaceholder'
import { buildPalette, type ImagePalette } from '../metadata/palette'
import { encodeCoefficients, encodeLinearGrid, type LinearGrid, srgbToLinear } from './codec'
import { BLURHASH_QUALITIES, type BlurhashQuality, blurhashFieldName, WEBP_QUALITIES, type WebpQuality, webpFieldName } from './qualities'

/** Longest sampling edge for the raw grid (blurhash + palette) — comfortably out-resolves
 *  the largest hash tier's 9 components on either axis. */
const SAMPLE_EDGE = 64

export interface ImageMetadataAnalysis {
  /** Every stored placeholder tier: `blurHashXs`…`blurHashXl` (hash strings) and
   *  `placeholderXxl`/`placeholderX3` (micro-webp data URIs), keyed by field name. */
  placeholderFields: Record<string, string>
  palette: ImagePalette
  /** The file carries an alpha channel. */
  hasAlpha: boolean
  /** No sampled pixel is actually transparent (approximate — from the 64px sample). */
  isOpaque: boolean
  /** Saliency-based focal suggestion (percentages), when Sharp's attention crop reports one. */
  attention?: { x: number; y: number }
}

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
  for (const quality of Object.keys(BLURHASH_QUALITIES) as BlurhashQuality[]) {
    //TODO: replace `as` cast with proper typing
    const [cx, cy] = BLURHASH_QUALITIES[quality]
    placeholderFields[blurhashFieldName(quality)] = encodeCoefficients(encodeLinearGrid(grid, cx, cy))
  }
  for (const quality of Object.keys(WEBP_QUALITIES) as WebpQuality[]) //TODO: replace `as` cast with proper typing
    placeholderFields[webpFieldName(quality)] = await encodeWebpPlaceholder(base, WEBP_QUALITIES[quality])

  return {
    placeholderFields,
    palette: buildPalette(grid),
    hasAlpha: meta.hasAlpha === true,
    isOpaque: minAlpha >= 250,
    attention: await attentionFocal(base.clone(), sourceDims(meta)),
  }
}

/**
 * Sharp's `attention` crop strategy reports the saliency center (`attentionX`/`attentionY`,
 * in resized-pre-extract coordinates) — mapped here to focal percentages. The strategy only
 * RUNS when the resize actually crops, so the probe requests an extreme-aspect thumbnail
 * (forcing a crop on one axis; the reported attention center is 2D either way), falling back
 * to the opposite aspect for sources extreme enough to make the first probe crop-free.
 * Returns undefined when nothing is reported (older libvips) or anything fails: the
 * suggestion is best-effort by design.
 */
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

/** Post-EXIF-rotation source dims (orientations ≥ 5 swap the axes). */
const sourceDims = (meta: { width?: number; height?: number; orientation?: number }): { w: number; h: number } | undefined => {
  if (!meta.width || !meta.height) return undefined
  const swapped = (meta.orientation ?? 1) >= 5
  return swapped ? { w: meta.height, h: meta.width } : { w: meta.width, h: meta.height }
}

/** Every stored placeholder tier for an image buffer — kept for callers that only need that half. */
export const generatePlaceholderFields = async (file: Buffer): Promise<Record<string, string>> =>
  (await analyzeImageMetadata(file)).placeholderFields

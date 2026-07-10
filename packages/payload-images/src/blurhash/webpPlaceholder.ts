/**
 * Micro-webp placeholders — the high-quality end of the placeholder tiers. Above ~9×9
 * components, blurhash spends bytes far less efficiently than a real image format, so the
 * upper tiers store a tiny full-frame webp data URI instead (generated once at upload).
 * Per-read focal cropping stays cheap: `cropWebpDataUri` extracts the requested window from
 * the STORED micro-image (a ~1 KB decode, three orders of magnitude smaller than touching
 * the original) and re-encodes — milliseconds, and typically behind the consumer's cache.
 * Server-only (Sharp).
 */
import type { Sharp } from 'sharp'

import type { CropWindow } from './window'
import { loadSharp } from '../transform/sharpInstance'

const WEBP_DATA_URI_PREFIX = 'data:image/webp;base64,'

export const isDataUri = (v: string): boolean => v.startsWith('data:')

/**
 * Encode the stored full-frame micro-webp for one tier: `width` px wide (never enlarged),
 * quality tuned for a blurred placeholder, alpha preserved. Takes a Sharp pipeline that is
 * already EXIF-rotated.
 */
export const encodeWebpPlaceholder = async (pipeline: Sharp, width: number): Promise<string> => {
  const buf = await pipeline.clone().resize(width, undefined, { withoutEnlargement: true }).webp({ quality: 55 }).toBuffer()
  return `${WEBP_DATA_URI_PREFIX}${buf.toString('base64')}`
}

/**
 * Crop a stored micro-webp data URI to a fractional window (the same `coverCropWindow`
 * geometry the transform endpoint and the blurhash crop use). Identity windows return the
 * stored URI untouched; any failure falls back to it too (a full-frame placeholder still
 * paints). No upscaling — the output is exactly the window's pixels of the stored image.
 */
export const cropWebpDataUri = async (uri: string, window: CropWindow): Promise<string> => {
  if (window.x0 <= 0 && window.y0 <= 0 && window.w >= 1 && window.h >= 1) return uri
  const comma = uri.indexOf(',')
  if (comma === -1) return uri
  try {
    const sharp = await loadSharp()
    const img = sharp(Buffer.from(uri.slice(comma + 1), 'base64'))
    const meta = await img.metadata()
    if (!meta.width || !meta.height) return uri
    const left = Math.min(meta.width - 1, Math.max(0, Math.round(window.x0 * meta.width)))
    const top = Math.min(meta.height - 1, Math.max(0, Math.round(window.y0 * meta.height)))
    const width = Math.max(1, Math.min(meta.width - left, Math.round(window.w * meta.width)))
    const height = Math.max(1, Math.min(meta.height - top, Math.round(window.h * meta.height)))
    const buf = await img.extract({ left, top, width, height }).webp({ quality: 55 }).toBuffer()
    return `${WEBP_DATA_URI_PREFIX}${buf.toString('base64')}`
  } catch {
    return uri
  }
}

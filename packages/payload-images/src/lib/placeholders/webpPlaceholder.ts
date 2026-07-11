/**
 * Micro-webp placeholders — the high-quality end of the tier ladder, where a real image format
 * out-spends blurhash per byte. Per-read cropping decodes the STORED ~1 KB micro-image, never
 * the original. Server-only (Sharp).
 */
import type { Sharp } from 'sharp'

import type { CropWindow } from './window'
import { loadSharp } from '../transform/sharpInstance'

const WEBP_DATA_URI_PREFIX = 'data:image/webp;base64,'

/** Encode the stored full-frame micro-webp for one tier. Takes an already-EXIF-rotated pipeline. */
export const encodeWebpPlaceholder = async (pipeline: Sharp, width: number): Promise<string> => {
  const buf = await pipeline.clone().resize(width, undefined, { withoutEnlargement: true }).webp({ quality: 55 }).toBuffer()
  return `${WEBP_DATA_URI_PREFIX}${buf.toString('base64')}`
}

/**
 * Crop a stored micro-webp data URI to a fractional window (same geometry as the transform
 * endpoint and the blurhash crop). Identity windows and any failure return the stored URI —
 * a full-frame placeholder still paints.
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

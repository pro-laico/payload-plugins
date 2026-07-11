/**
 * Reading the stored placeholder data off an image doc: the best tier at or below the requested
 * one (so docs predating a tier still get a placeholder), plus the focal/hotspot crop window.
 */
import { coverCropWindow } from '../../lib/placeholders/window'
import {
  BLURHASH_TIERS,
  type BlurhashQuality,
  blurhashFieldName,
  WEBP_TIERS,
  type WebpQuality,
  webpFieldName,
} from '../../lib/placeholders/qualities'
import type { CropWindow } from '../../types'
import type { ImageDocLike } from '../../types/placeholders/blurhashDoc'

const storedString = (doc: ImageDocLike, field: string): string | undefined => {
  const v = doc[field]
  return typeof v === 'string' && v ? v : undefined
}

/** The best stored hash at or below the requested tier — docs predating a tier still get a placeholder. */
export const storedHash = (doc: ImageDocLike, quality: BlurhashQuality): string | undefined => {
  for (let i = BLURHASH_TIERS.indexOf(quality); i >= 0; i--) {
    const hash = storedString(doc, blurhashFieldName(BLURHASH_TIERS[i]!))
    if (hash) return hash
  }
  return undefined
}

/** The best stored micro-webp at or below the requested tier. */
export const storedWebp = (doc: ImageDocLike, quality: WebpQuality): string | undefined => {
  for (let i = WEBP_TIERS.indexOf(quality); i >= 0; i--) {
    const uri = storedString(doc, webpFieldName(WEBP_TIERS[i]!))
    if (uri) return uri
  }
  return undefined
}

/** The focal/hotspot crop window for a requested ratio, or undefined when there's nothing to crop to. */
export const cropWindow = (doc: ImageDocLike, ar: number | undefined): CropWindow | undefined => {
  const sw = typeof doc.width === 'number' ? doc.width : undefined
  const sh = typeof doc.height === 'number' ? doc.height : undefined
  if (!ar || !sw || !sh) return undefined
  return coverCropWindow(sw / sh, ar, doc.focalX ?? 50, doc.focalY ?? 50, {
    focalSize: doc.focalSize,
    cropLeft: doc.cropLeft,
    cropTop: doc.cropTop,
    cropRight: doc.cropRight,
    cropBottom: doc.cropBottom,
  })
}

import type { FieldHook } from 'payload'

import { readRequest } from '../../lib/placeholders/request'
import { blurhashToPngDataUri } from '../../lib/placeholders/png'
import { cropWebpDataUri } from '../../lib/placeholders/webpPlaceholder'
import type { ImageDocLike } from '../../types/placeholders/blurhashDoc'
import { cropBlurhashCoefficients } from '../../lib/placeholders/cropCoefficients'
import { cropWindow, storedHash, storedWebp } from '../../lib/placeholders/stored'
import { DEFAULT_BLURHASH_QUALITY, isBlurhashQuality, isWebpQuality } from '../../lib/placeholders/qualities'
import { isRecord } from '../../lib/isRecord'

const isImageDoc = (v: unknown): v is ImageDocLike => isRecord(v)

export const placeholderAfterRead: FieldHook = async ({ data, req }) => {
  const doc: ImageDocLike = isImageDoc(data) ? data : {}
  const wanted = readRequest(req)

  if (!wanted.declared && wanted.ar === undefined && wanted.quality === undefined && wanted.format === undefined)
    return storedHash(doc, DEFAULT_BLURHASH_QUALITY) ?? null

  const quality = wanted.quality ?? DEFAULT_BLURHASH_QUALITY

  if (wanted.format === 'hash') {
    const hash = storedHash(doc, isBlurhashQuality(quality) ? quality : 'xl')
    if (!hash) return null
    const window = cropWindow(doc, wanted.ar)
    if (!window) return hash
    try {
      return cropBlurhashCoefficients(hash, window)
    } catch {
      return hash
    }
  }

  if (isWebpQuality(quality)) {
    const uri = storedWebp(doc, quality)
    if (uri) {
      const window = cropWindow(doc, wanted.ar)
      return window ? await cropWebpDataUri(uri, window) : uri
    }
  }

  const hash = storedHash(doc, isBlurhashQuality(quality) ? quality : 'xl')
  if (!hash) return null
  try {
    const window = cropWindow(doc, wanted.ar)
    const cropped = window ? cropBlurhashCoefficients(hash, window) : hash
    const sw = typeof doc.width === 'number' ? doc.width : undefined
    const sh = typeof doc.height === 'number' ? doc.height : undefined
    const ar = wanted.ar ?? (sw && sh ? sw / sh : undefined)
    return blurhashToPngDataUri(cropped, ar ? { aspectRatio: ar } : {})
  } catch {
    return null
  }
}

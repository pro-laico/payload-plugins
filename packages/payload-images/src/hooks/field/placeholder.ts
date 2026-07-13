/**
 * The `placeholder` field's afterRead — the read side of the placeholder pipeline. Three
 * behaviors, chosen by the read: no declared intent → the raw `sm` hash (light for admin/API
 * reads); a declared intent (`context.image`/`context.blur`, or an `X-Blurhash` header on REST)
 * → a FINISHED data URI focal-cropped to the declared ratio; `blur.format: 'hash'` → the cropped
 * raw hash string for client-side decoders.
 */
import type { FieldHook } from 'payload'

import { blurhashToPngDataUri } from '../../lib/placeholders/png'
import { cropWebpDataUri } from '../../lib/placeholders/webpPlaceholder'
import { cropBlurhashCoefficients } from '../../lib/placeholders/cropCoefficients'
import { DEFAULT_BLURHASH_QUALITY, isBlurhashQuality, isWebpQuality } from '../../lib/placeholders/qualities'
import { readRequest } from '../../lib/placeholders/request'
import { cropWindow, storedHash, storedWebp } from '../../lib/placeholders/stored'
import type { ImageDocLike } from '../../types/placeholders/blurhashDoc'

export const placeholderAfterRead: FieldHook = async ({ data, req }) => {
  const doc = (data ?? {}) as ImageDocLike //EXCUSE: hook data is untyped; every field is duck-checked before use
  const wanted = readRequest(req)

  // Only a read that declared NOTHING gets the raw hash (light for admin/API reads). A declared
  // render — even an empty one (e.g. the natural ratio) — pairs with <ResponsiveImage>, which
  // paints the placeholder as a CSS url(), so it must always get a finished data URI.
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

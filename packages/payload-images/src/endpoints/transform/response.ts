/**
 * HTTP response construction for the transform endpoint: long-lived cache headers (variants are
 * content-addressed, so `immutable`) and the Buffer-as-body bridge.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable'
const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable'

export const toBody = (buf: Buffer): BodyInit => buf as unknown as BodyInit //EXCUSE: Buffer's ArrayBufferLike backing fails lib.dom's BodyInit, but Response accepts Node Buffers at runtime; a typed view would copy the bytes

export const buildHeaders = (mime: string, key: string, isAuto: boolean, cdn: boolean, isPublic: boolean): Record<string, string> => {
  const h: Record<string, string> = {
    'Content-Type': mime,
    'Cache-Control': isPublic ? IMMUTABLE : PRIVATE_IMMUTABLE,
    ETag: `"${key}"`,
  }
  if (cdn && isPublic) {
    h['CDN-Cache-Control'] = IMMUTABLE
    h['Vercel-CDN-Cache-Control'] = IMMUTABLE
  }
  if (isAuto) h.Vary = 'Accept'
  return h
}

/** Headers for a nearby-fallback stand-in: NOTHING may cache it — browser, CDN, or proxy — so the
 *  exact variant (generating in the background) takes over on the very next request. No ETag: the
 *  bytes are not the resource this URL names. */
export const buildFallbackHeaders = (mime: string, isAuto: boolean, cdn: boolean): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': mime, 'Cache-Control': 'no-store' }
  if (cdn) {
    h['CDN-Cache-Control'] = 'no-store'
    h['Vercel-CDN-Cache-Control'] = 'no-store'
  }
  if (isAuto) h.Vary = 'Accept'
  return h
}

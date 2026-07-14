const IMMUTABLE = 'public, max-age=31536000, immutable'
const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable'

export const toBody = (buf: Buffer): BodyInit => buf as unknown as BodyInit //TODO: replace `as` cast with proper typing

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

export const buildFallbackHeaders = (mime: string, isAuto: boolean, cdn: boolean): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': mime, 'Cache-Control': 'no-store' }
  if (cdn) {
    h['CDN-Cache-Control'] = 'no-store'
    h['Vercel-CDN-Cache-Control'] = 'no-store'
  }
  if (isAuto) h.Vary = 'Accept'
  return h
}

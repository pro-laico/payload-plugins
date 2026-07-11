import { deriveVersion } from './version'
import { buildVariantUrl } from './variantUrl'
import type { GetImageUrlOptions, ImageResource } from '../../types'

/**
 * One transform URL from an id OR a populated doc, with the cache-busting version folded in —
 * for OG tags, CSS backgrounds, emails. Because these contexts are usually external/shareable,
 * `baseUrl` defaults to `NEXT_PUBLIC_SERVER_URL` so the result is absolute with no extra wiring.
 * For a responsive `<img>`, prefer `<ResponsiveImage>` / `buildSrcset`.
 */
export const getImageUrl = (resource: ImageResource, o: GetImageUrlOptions = {}): string | null => {
  if (resource == null) return null
  const doc = typeof resource === 'object' ? resource : undefined
  const id = doc ? (doc.id == null ? '' : String(doc.id)) : String(resource)
  if (!id) return null
  const width = o.width ?? doc?.width ?? 1280
  return buildVariantUrl(id, width, {
    ...o,
    baseUrl: o.baseUrl ?? (process.env.NEXT_PUBLIC_SERVER_URL || undefined),
    version: o.version ?? deriveVersion(doc),
  })
}

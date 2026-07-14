import { deriveVersion } from './version'
import { buildVariantUrl } from './variantUrl'
import type { GetImageUrlOptions, ImageResource } from '../../types'

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

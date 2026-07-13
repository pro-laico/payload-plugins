import { parseAspectRatio } from '../transform/params'
import type { BuildUrlOptions } from '../../types'

/** Default endpoint base: `/api` + the fixed `/img` path. Override `path` only for a custom API route / basePath. */
export const DEFAULT_TRANSFORM_API_PATH = '/api/img'

/** One transform URL for an image id at a given width — or a named preset when `o.preset` is set. */
export const buildVariantUrl = (id: string, width: number, o: BuildUrlOptions = {}): string => {
  const base = o.baseUrl ?? ''
  const params = new URLSearchParams()
  const apiPath = o.path ?? DEFAULT_TRANSFORM_API_PATH
  if (o.preset) {
    params.set('preset', o.preset)
    if (o.version) params.set('v', o.version)
    return `${base}${apiPath}/${encodeURIComponent(id)}?${params.toString()}`
  }
  const ar = parseAspectRatio(o.aspectRatio)
  params.set('w', String(Math.round(width)))
  if (ar) params.set('h', String(Math.round(width / ar)))
  params.set('fit', o.fit ?? 'cover')
  params.set('q', String(o.quality ?? 75))
  params.set('fmt', o.format ?? 'auto')
  if (o.version) params.set('v', o.version)
  return `${base}${apiPath}/${encodeURIComponent(id)}?${params.toString()}`
}

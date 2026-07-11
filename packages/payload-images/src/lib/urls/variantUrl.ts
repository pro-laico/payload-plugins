import { type Fit, type Format, parseAspectRatio } from '../transform/params'

/** Default endpoint base: `/api` + the fixed `/img` path. Override `path` only for a custom API route / basePath. */
export const DEFAULT_TRANSFORM_API_PATH = '/api/img'

export interface BuildUrlOptions {
  fit?: Fit
  quality?: number
  format?: Format
  /** Render aspect ratio (`16/9` | `"16:9"`); derives `h` from each width. */
  aspectRatio?: number | string
  /** Prefix for absolute URLs (e.g. `https://site.com`). Default '' (same-origin). */
  baseUrl?: string
  /** Endpoint base. Default {@link DEFAULT_TRANSFORM_API_PATH}. */
  path?: string
  /** Cache-busting token appended as `v=` — derive it with `deriveVersion` so a file replace or
   *  focal edit yields a new URL. The server ignores it; it only makes the immutable URL honest. */
  version?: string
}

/** One transform URL for an image id at a given width. */
export const buildVariantUrl = (id: string, width: number, o: BuildUrlOptions = {}): string => {
  const base = o.baseUrl ?? ''
  const params = new URLSearchParams()
  const ar = parseAspectRatio(o.aspectRatio)
  const apiPath = o.path ?? DEFAULT_TRANSFORM_API_PATH
  params.set('w', String(Math.round(width)))
  if (ar) params.set('h', String(Math.round(width / ar)))
  params.set('fit', o.fit ?? 'cover')
  params.set('q', String(o.quality ?? 75))
  params.set('fmt', o.format ?? 'auto')
  if (o.version) params.set('v', o.version)
  return `${base}${apiPath}/${encodeURIComponent(id)}?${params.toString()}`
}

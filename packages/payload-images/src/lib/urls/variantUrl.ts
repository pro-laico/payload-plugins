import type { BuildUrlOptions } from '../../types'
import { DEFAULT_CONSTRAINTS, parseAspectRatio } from '../transform/params'

export const DEFAULT_TRANSFORM_API_PATH = '/api/img'

export const buildVariantUrl = (id: string | number, width: number, o: BuildUrlOptions = {}): string => {
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
  // Clamped: an extreme ratio at a small width rounds to 0, which the endpoint 400s.
  if (ar) params.set('h', String(Math.max(1, Math.round(width / ar))))
  params.set('fit', o.fit ?? 'cover')
  // Sourced from DEFAULT_CONSTRAINTS so the URL builder and the endpoint can never disagree about
  // the default — a mismatch silently doubles the variant space (same render, two cache keys).
  params.set('q', String(o.quality ?? DEFAULT_CONSTRAINTS.defaultQuality))
  params.set('fmt', o.format ?? 'auto')
  if (o.version) params.set('v', o.version)
  return `${base}${apiPath}/${encodeURIComponent(id)}?${params.toString()}`
}

import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

export interface BlurhashRequest {
  declared?: boolean
  /** True when the request is the sm-by-default fallback rather than an explicit blur. */
  implicit?: boolean
  ar?: number
  quality?: PlaceholderQuality
  format?: PlaceholderFormat
}

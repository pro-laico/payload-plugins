import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

export interface BlurhashRequest {
  declared?: boolean
  ar?: number
  quality?: PlaceholderQuality
  format?: PlaceholderFormat
}

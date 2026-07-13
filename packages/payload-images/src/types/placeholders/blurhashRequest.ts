/** What the read asked the `placeholder` virtual for: crop ratio, tier, and answer form. */
import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

export interface BlurhashRequest {
  /** True when the read declared a render at all (`context.image`/`context.blur`, even empty, or
   *  an `X-Blurhash` header) — a declared read gets a finished data URI, never the raw hash. */
  declared?: boolean
  /** Target aspect ratio (`"16:9"` or `1.78`) — crops the placeholder to match. */
  ar?: number
  /** Placeholder tier: `xs`…`xl` (blurhash) or `xxl`/`x3` (micro-webp). Default `sm`. */
  quality?: PlaceholderQuality
  /** `uri` (default): a finished data URI. `hash`: the cropped raw hash string. */
  format?: PlaceholderFormat
}

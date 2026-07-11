/** What the read asked the `croppedBlurHash` virtual for: crop ratio, tier, and answer form. */
import type { PlaceholderFormat, PlaceholderQuality } from '../../lib/placeholders/qualities'

export interface BlurhashRequest {
  /** Target aspect ratio (`16/9`, `"16:9"`, `1.78`) — crops the placeholder to match. */
  ar?: number
  /** Placeholder tier: `xs`…`xl` (blurhash) or `xxl`/`x3` (micro-webp). Default `sm`. */
  quality?: PlaceholderQuality
  /** `uri` (default): a finished data URI. `hash`: the cropped raw hash string. */
  format?: PlaceholderFormat
}

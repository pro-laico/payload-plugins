/** Shared options for the isomorphic transform-URL builders. */
import type { Fit, Format } from '../transform/format'

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

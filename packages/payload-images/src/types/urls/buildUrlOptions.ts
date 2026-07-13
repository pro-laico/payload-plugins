/** Shared options for the isomorphic transform-URL builders. */
import type { Fit, Format } from '../transform/format'
import type { AspectRatio } from '../plugin/renderIntent'

export interface BuildUrlOptions {
  fit?: Fit
  quality?: number
  format?: Format
  /** Render aspect ratio (`16 / 9` | `"16:9"`); derives `h` from each width. */
  aspectRatio?: AspectRatio
  /** Prefix for absolute URLs (e.g. `https://site.com`). Default '' (same-origin). */
  baseUrl?: string
  /** Endpoint base. Default {@link DEFAULT_TRANSFORM_API_PATH}. */
  path?: string
  /** Cache-busting token appended as `v=` — derive it with `deriveVersion` so a file replace or
   *  focal edit yields a new URL. The server ignores it; it only makes the immutable URL honest. */
  version?: string
  /** Serve a named preset (`?preset=name`) — a guaranteed, cap-exempt variant. When set, the
   *  width/fit/quality/format/ratio options are ignored (the preset defines them server-side). */
  preset?: string
}

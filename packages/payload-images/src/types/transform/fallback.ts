/** A generated-images row as the nearby-fallback picker scores it (actual output dims + settings). */
import type { UploadDocLike } from './uploadDoc'

export type FallbackCandidate = UploadDocLike & {
  id: string | number
  width?: number | null
  height?: number | null
  fit?: string | null
  format?: string | null
  quality?: number | null
  mimeType?: string | null
  /** The focal point baked into this variant's crop — compared to the source's CURRENT focal so a
   *  stale-focal variant (e.g. one persisted by a request that raced a focal edit) is never served. */
  focalX?: number | null
  focalY?: number | null
}

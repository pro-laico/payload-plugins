import type { UploadDocLike } from './uploadDoc'

export type FallbackCandidate = UploadDocLike & {
  id: string | number
  width?: number | null
  height?: number | null
  fit?: string | null
  format?: string | null
  quality?: number | null
  mimeType?: string | null
  focalX?: number | null
  focalY?: number | null
  windowed?: boolean | null
}

/** The slice of the source doc the fallback picker needs: dims for the ratio anchor, the focal
 * pair for the stale-crop guard, and the hotspot window for the achievable-width clamp. */
export interface FallbackSource {
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

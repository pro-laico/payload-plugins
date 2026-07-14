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
}

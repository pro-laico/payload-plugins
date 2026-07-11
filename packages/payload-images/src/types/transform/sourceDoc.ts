/** A source image doc as the transform handler consumes it — upload fields plus focal/crop. */
import type { UploadDocLike } from './uploadDoc'

export type SourceDoc = UploadDocLike & {
  id: string | number
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

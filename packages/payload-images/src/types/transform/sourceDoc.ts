/** A source image doc as the transform handler consumes it — upload fields plus focal/crop. */
import type { PresetEntry } from '../presets/preset'
import type { UploadDocLike } from './uploadDoc'

export type SourceDoc = UploadDocLike & {
  id: string | number
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
  /** Per-image guaranteed presets (template refs + custom). */
  presets?: PresetEntry[] | null
  /** Per-image override of the variant cap; falls back to the endpoint's configured default. */
  variantLimit?: number | null
}

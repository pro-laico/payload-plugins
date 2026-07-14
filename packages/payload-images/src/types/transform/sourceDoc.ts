import type { UploadDocLike } from './uploadDoc'
import type { PresetEntry } from '../presets/preset'

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
  presets?: PresetEntry[] | null
  variantLimit?: number | null
}

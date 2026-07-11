/** The image-doc shape the stored-placeholder reader duck-checks (tiers + focal/hotspot crop). */

export interface ImageDocLike {
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
  [key: string]: unknown
}

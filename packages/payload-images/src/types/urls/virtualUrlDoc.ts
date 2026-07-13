/** The doc shape the virtual URL afterRead hooks (hooks/field/virtualUrls) read their inputs from. */
export interface ImageDocLike {
  id?: string | number
  width?: number | null
  height?: number | null
  filename?: string | null
  url?: string | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

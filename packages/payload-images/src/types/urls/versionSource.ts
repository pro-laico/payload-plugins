/** Source-identity fields that determine the rendered pixels (independent of size/quality). */
export interface VersionSource {
  filename?: string | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

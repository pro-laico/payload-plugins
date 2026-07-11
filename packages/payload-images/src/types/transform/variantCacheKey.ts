/** The source-identity fields folded into a generated variant's deterministic cache key. */

export interface CacheKeyDoc {
  id: string | number
  filename?: string | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

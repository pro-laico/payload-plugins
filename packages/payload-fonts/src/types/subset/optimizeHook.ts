import type { Charset } from './charset'

/** A weight/style file the typeface should have an optimized WOFF2 for. */
export interface Desired {
  originalId: string | number
  style: 'normal' | 'italic'
  isVariable: boolean
  /** Static rows carry an explicit weight; variable files derive a range from the binary. */
  weight?: string
}

export interface OptimizeFromOriginalsOptions {
  /** Characters to keep, or a preset name ('latin' | 'latin-ext'). Default 'latin'. */
  charset?: Charset
  /** Slug of the archival original collection. Default 'fontOriginal'. */
  originalSlug?: string
  /** Slug of the optimized (served) collection. Default 'fontOptimized'. */
  optimizedSlug?: string
}

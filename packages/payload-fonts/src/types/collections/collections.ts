import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface CreateFontCollectionOptions {
  /** Characters the subsetter keeps, or a preset ('latin' | 'latin-ext'). Default 'latin'. */
  charset?: Charset
  /** Slug of the archival original upload collection. Default 'fontOriginal'. */
  originalSlug?: string
  /** Slug of the optimized (served) upload collection. Default 'fontOptimized'. */
  optimizedSlug?: string
  /** The options offered by the `family` field. Default sans/serif/mono/display. */
  families?: FontFamilyConfig[]
}

export interface CreateFontOptimizedCollectionOptions {
  /** Slug of the `Font` typeface collection these belong to. Default 'font'. */
  fontSlug?: string
  /** Slug of the archival original collection each is derived from. Default 'fontOriginal'. */
  originalSlug?: string
}

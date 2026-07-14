import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface CreateFontOptimizedCollectionOptions {
  fontSlug?: string
  originalSlug?: string
}

export interface CreateFontCollectionOptions {
  charset?: Charset
  originalSlug?: string
  optimizedSlug?: string
  families?: FontFamilyConfig[]
}

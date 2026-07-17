import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

// The factories take every slug they reference — the plugin resolves each one once, from the
// matching `collections.<name>.slug` override, and threads it down. No factory re-derives one.
export interface CreateFontOptimizedCollectionOptions {
  slug: string
  fontSlug: string
  originalSlug: string
}

export interface CreateFontOriginalCollectionOptions {
  slug: string
}

export interface CreateFontCollectionOptions {
  slug: string
  originalSlug: string
  optimizedSlug: string
  charset: Charset | undefined
  families: FontFamilyConfig[] | undefined
}

export interface CreateFontSetGlobalOptions {
  slug: string
  fontSlug: string
  families: FontFamilyConfig[] | undefined
}

export interface FontUploadFieldsOptions {
  fontSlug: string
  families: FontFamilyConfig[] | undefined
}

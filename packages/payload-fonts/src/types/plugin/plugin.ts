import type { CollectionConfig, GlobalConfig } from 'payload'

import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface FontsPluginOptions {
  /** When false, the plugin is a no-op. Defaults to true. */
  enabled?: boolean
  /**
   * Characters the subsetter keeps when building the served WOFF2 files: a preset name
   * (`'latin'` — ASCII + Latin-1 + common punctuation, the default; or `'latin-ext'`) or an
   * explicit string of characters to retain.
   */
  charset?: Charset
  /**
   * The font *families* (slots) the plugin exposes end-to-end — the `family` options on the `font`
   * collection, the relationship slots on the `fontSet` global, the keys in the export JSON, and
   * (capitalised) the generated `font<Key>` / `--font-set<Key>` names. Defaults to the built-in
   * `sans / serif / mono / display`. Pass your own list to replace, extend, drop, or reorder them
   * — e.g. `[{ key: 'sans' }, { key: 'display' }, { key: 'brand', fallback: 'Georgia, serif' }]`.
   * Each entry is `{ key, label?, fallback? }`; only `key` is required.
   */
  families?: FontFamilyConfig[]
  /** Merged onto the visible `font` (typeface) collection. */
  fontOverrides?: Partial<CollectionConfig>
  /**
   * Merged onto the hidden `fontOriginal` upload collection (the raw files editors upload
   * into) — e.g. `upload: { staticDir }`.
   */
  fontOriginalOverrides?: Partial<CollectionConfig>
  /** Merged onto the hidden `fontOptimized` upload collection (the served WOFF2s). */
  fontOptimizedOverrides?: Partial<CollectionConfig>
  /**
   * Register the `fontSet` global — the active sans/serif/mono/display selection that the export
   * endpoint (and your frontend) reads. **On by default**, since it's the only place to mark which
   * typefaces are active; set `false` only if you drive that selection some other way (without it
   * the export endpoint has nothing to resolve and returns no fonts).
   */
  includeFontSet?: boolean
  /** Merged onto the `fontSet` global when {@link includeFontSet} is true. */
  fontSetOverrides?: Partial<GlobalConfig>
}

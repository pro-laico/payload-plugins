import type { CollectionConfig, GlobalConfig } from 'payload'

import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface FontsCollectionsOptions {
  /** Merged onto the visible `font` typeface collection. Always registered. */
  font?: Partial<CollectionConfig>
  /** Merged onto the hidden originals upload collection (e.g. an `upload.staticDir`). Always registered. */
  fontOriginal?: Partial<CollectionConfig>
  /** Merged onto the hidden served-WOFF2 upload collection. Always registered. */
  fontOptimized?: Partial<CollectionConfig>
}

export interface FontsGlobalsOptions {
  /** Merged onto the `fontSet` global — the active typeface per family; `false` skips it. */
  fontSet?: false | Partial<GlobalConfig>
}

export interface FontsPluginOptions {
  /** Register nothing when false — no collections, global, or endpoint. Default `true`. */
  enabled?: boolean
  /** The collections this plugin registers.
   *
   * - `font`
   * - `fontOriginal`
   * - `fontOptimized` */
  collections?: FontsCollectionsOptions
  /** The globals this plugin registers.
   *
   * - `fontSet` */
  globals?: FontsGlobalsOptions
  /** Characters the subsetter keeps in the served files. Default `'latin'`. */
  charset?: Charset
  /** The font slots. Replaces the sans/serif/mono/display defaults wholesale — spread
   * `DEFAULT_FONT_FAMILIES` to keep them.
   *
   * - `key`
   * - `label`
   * - `fallback` */
  families?: FontFamilyConfig[]
}

export interface ResolvedFontsOptions {
  enabled: boolean
  font: Partial<CollectionConfig> | undefined
  fontOriginal: Partial<CollectionConfig> | undefined
  fontOptimized: Partial<CollectionConfig> | undefined
  fontSet: false | Partial<GlobalConfig>
  charset: Charset | undefined
  families: FontFamilyConfig[] | undefined
}

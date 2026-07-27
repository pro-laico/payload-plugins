import type { CollectionConfig, GlobalConfig } from 'payload'

import type { CollectionOption, EndpointAccess, GlobalOption } from '../../_kit'
import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface FontsAccessOptions {
  /** Who may call the export endpoint (`GET /fonts/export`). Defaults to the `PAYLOAD_SECRET`
   * bearer-token check: this endpoint is called by headless builds with no user session, so the
   * default gate ignores `req.user` and compares an `Authorization: Bearer <PAYLOAD_SECRET>`
   * header instead. Override to gate it however you like. */
  export?: EndpointAccess
}

export interface FontsOptions {
  /** Characters the subsetter keeps in the served files. Default `'latin'`. */
  charset?: Charset
  /** The font slots. Replaces the sans/serif/mono/display defaults wholesale — spread
   * `DEFAULT_FONT_FAMILIES` to keep them.
   *
   * - `key`
   * - `label`
   * - `fallback` */
  families?: FontFamilyConfig[]
  /** Per-endpoint gates for the plugin's HTTP endpoints.
   *
   * - `export` — active-fonts export endpoint; defaults to the `PAYLOAD_SECRET` bearer check */
  access?: FontsAccessOptions
}

export interface FontsPluginOptions {
  /** Register nothing when false — no collections, global, or endpoint. Default `true`. */
  enabled?: boolean
  /** The collections this plugin registers.
   *
   * - `font`
   * - `fontOriginal`
   * - `fontOptimized` */
  collections?: {
    /** The visible `font` typeface collection: `slug` renames it, `overrides` is the Payload
     * passthrough. Always registered — no `false`. */
    font?: CollectionOption
    /** The hidden originals upload collection (e.g. an `upload.staticDir` in `overrides`). Always
     * registered — no `false`. */
    fontOriginal?: CollectionOption
    /** The hidden served-WOFF2 upload collection. Always registered — no `false`. */
    fontOptimized?: CollectionOption
  }
  /** The globals this plugin registers.
   *
   * - `fontSet` */
  globals?: {
    /** The `fontSet` global — the active typeface per family; `false` skips it. */
    fontSet?: false | GlobalOption
  }
  /** This plugin's own knobs.
   *
   * - `charset`
   * - `families` */
  options?: FontsOptions
}

/** The resolved counterpart of {@link CollectionOption} — every key present, defaults applied. */
interface ResolvedCollectionOption {
  slug: string | undefined
  overrides: Partial<CollectionConfig> | undefined
  options: Record<string, never>
}

/** The resolved counterpart of {@link GlobalOption} — every key present, defaults applied. */
interface ResolvedGlobalOption {
  slug: string | undefined
  overrides: Partial<GlobalConfig> | undefined
  options: Record<string, never>
}

/** Mirrors `FontsPluginOptions`: same keys, same nesting, defaults applied. */
export interface ResolvedFontsOptions {
  enabled: boolean
  collections: {
    font: ResolvedCollectionOption
    fontOriginal: ResolvedCollectionOption
    fontOptimized: ResolvedCollectionOption
  }
  globals: {
    fontSet: false | ResolvedGlobalOption
  }
  options: {
    charset: Charset | undefined
    families: FontFamilyConfig[] | undefined
    access: { export: EndpointAccess | undefined }
  }
}

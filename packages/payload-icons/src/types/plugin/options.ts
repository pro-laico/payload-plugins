import type { CollectionConfig } from 'payload'

import type { CollectionOption } from '../../_kit'

/** A resolved `collections.<name>` entry — same shape as {@link CollectionOption}, but `options` is
 * always populated with this plugin's defaults for the collection. */
export type ResolvedCollectionOption<O = Record<string, never>> = CollectionOption<O> & { options: O }

/** This plugin's own knobs for the `iconSet` collection.
 *
 * - `usagePanel`
 * - `iconRowFields` */
export interface IconSetOptions {
  /** Render the "Requested icons" panel on the set's edit view. Default `true`. */
  usagePanel?: boolean
  /** Appended to every row of the set's icon array, beside the name and upload. */
  iconRowFields?: CollectionConfig['fields']
}

/** Mirrors {@link IconSetOptions} — every key present, defaults applied. */
export interface ResolvedIconSetOptions {
  usagePanel: boolean
  iconRowFields: CollectionConfig['fields']
}

/** The collections this plugin registers.
 *
 * - `icon`
 * - `iconSet`
 * - `iconRequest` */
export interface IconsCollectionsOptions {
  /** The core `icon` upload collection. Always registered. */
  icon?: CollectionOption
  /** The `iconSet` collection; `false` skips it. */
  iconSet?: false | CollectionOption<IconSetOptions>
  /** The `iconRequest` collection; `false` skips it and its clear endpoint — nothing tracks missing icons. */
  iconRequest?: false | CollectionOption
}

/** Mirrors {@link IconsCollectionsOptions} — every key present, defaults applied. */
export interface ResolvedIconsCollectionsOptions {
  icon: ResolvedCollectionOption
  iconSet: false | ResolvedCollectionOption<ResolvedIconSetOptions>
  iconRequest: false | ResolvedCollectionOption
}

export interface IconsPluginOptions {
  /** Register nothing when false — no collections, endpoints, or hooks. Default `true`. */
  enabled?: boolean
  /** The collections this plugin registers.
   *
   * - `icon`
   * - `iconSet`
   * - `iconRequest` */
  collections?: IconsCollectionsOptions
}

/** Mirrors {@link IconsPluginOptions}: same keys, same nesting, defaults applied. */
export interface ResolvedIconsOptions {
  enabled: boolean
  collections: ResolvedIconsCollectionsOptions
}

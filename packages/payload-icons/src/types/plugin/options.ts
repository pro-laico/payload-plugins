import type { IconCollectionOverrides } from '../collections/icon-collection'
import type { IconSetCollectionOverrides } from '../collections/icon-set-collection'
import type { IconRequestCollectionOverrides } from '../collections/icon-request-collection'

export interface IconsCollectionsOptions {
  /** Merged onto the `icon` upload collection. Always registered. */
  icon?: IconCollectionOverrides
  /** Merged onto the `iconSet` collection; `false` skips it entirely. */
  iconSet?: false | IconSetCollectionOverrides
  /** Merged onto the `iconRequest` collection; `false` skips it and its clear endpoint — nothing tracks missing icons. */
  iconRequest?: false | IconRequestCollectionOverrides
}

export interface IconsAdminOptions {
  /** The "Requested icons" panel on the iconSet edit view. Default `true`. */
  usagePanel?: boolean
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
  /** Admin-only toggles.
   *
   * - `usagePanel` */
  admin?: IconsAdminOptions
}

export interface ResolvedIconsOptions {
  enabled: boolean
  icon: IconCollectionOverrides
  iconSet: false | IconSetCollectionOverrides
  iconRequest: false | IconRequestCollectionOverrides
  usagePanel: boolean
}

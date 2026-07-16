import type { IconCollectionOverrides } from '../collections/icon-collection'
import type { IconSetCollectionOverrides } from '../collections/icon-set-collection'
import type { IconRequestCollectionOverrides } from '../collections/icon-request-collection'

export interface IconsCollectionsOptions {
  icon?: IconCollectionOverrides
  /** `false` skips the iconSet collection entirely. */
  iconSet?: false | IconSetCollectionOverrides
  /** `false` skips the iconRequest collection and its clear endpoint — nothing tracks missing icons. */
  iconRequest?: false | IconRequestCollectionOverrides
}

export interface IconsAdminOptions {
  /** The usage panel on the iconSet edit view. Live-scans the source tree on every render in dev. */
  usagePanel?: boolean
}

export interface IconsPluginOptions {
  enabled?: boolean
  collections?: IconsCollectionsOptions
  admin?: IconsAdminOptions
}

export interface ResolvedIconsOptions {
  enabled: boolean
  icon: IconCollectionOverrides
  iconSet: false | IconSetCollectionOverrides
  iconRequest: false | IconRequestCollectionOverrides
  usagePanel: boolean
}

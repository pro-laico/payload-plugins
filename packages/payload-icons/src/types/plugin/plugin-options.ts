import type { IconCollectionOverrides } from '../collections/icon-collection'
import type { IconSetCollectionOverrides } from '../collections/icon-set-collection'
import type { IconRequestCollectionOverrides } from '../collections/icon-request-collection'

export interface IconsPluginOptions {
  enabled?: boolean
  iconOverrides?: IconCollectionOverrides
  includeIconSet?: boolean
  iconSetOverrides?: IconSetCollectionOverrides
  usagePanel?: boolean
  trackRequests?: boolean
  iconRequestOverrides?: IconRequestCollectionOverrides
}

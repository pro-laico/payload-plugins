import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import type { IconsPluginOptions } from './types'
import { createIconSetCollection, ICON_SET_SLUG } from './collections/IconSet'
import { createClearIconRequestsEndpoint } from './endpoints/clearIconRequests'
import { createIconRequestCollection, ICON_REQUEST_SLUG } from './collections/IconRequest'

export const iconsPlugin =
  (opts: IconsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      iconOverrides,
      includeIconSet = true,
      iconSetOverrides,
      usagePanel = true,
      trackRequests = true,
      iconRequestOverrides,
    } = opts
    if (!enabled) return config

    const additions: CollectionConfig[] = [Icon(iconOverrides)]
    if (includeIconSet) additions.push(createIconSetCollection({ iconSlug: iconOverrides?.slug ?? 'icon', usagePanel, ...iconSetOverrides }))
    if (trackRequests) additions.push(createIconRequestCollection(iconRequestOverrides))

    return {
      ...config,
      collections: [...(config.collections ?? []), ...additions],
      endpoints: trackRequests ? [...(config.endpoints ?? []), createClearIconRequestsEndpoint()] : config.endpoints,
      custom: {
        ...config.custom,
        payloadIcons: {
          options: opts,
          iconSlug: iconOverrides?.slug ?? 'icon',
          iconSetSlug: includeIconSet ? (iconSetOverrides?.slug ?? ICON_SET_SLUG) : null,
          iconRequestSlug: trackRequests ? ICON_REQUEST_SLUG : null,
        },
      },
    }
  }

export default iconsPlugin

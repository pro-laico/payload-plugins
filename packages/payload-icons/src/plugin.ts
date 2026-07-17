import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import { resolveOptions } from './options'
import { createIconSetCollection, ICON_SET_SLUG } from './collections/IconSet'
import { createClearIconRequestsEndpoint } from './endpoints/clearIconRequests'
import type { IconsPluginOptions, PayloadIconsMarker } from './types'
import { createIconRequestCollection, ICON_REQUEST_SLUG } from './collections/IconRequest'

/** Your own icon set in Payload: upload an `.svg` and it's optimized, sanitized, and themed to
 * `currentColor` on save, then rendered by `<Icon name="…">`.
 *
 * - `enabled`
 * - `collections`
 * - `admin`
 */
export const iconsPlugin =
  (opts: IconsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const { enabled, icon, iconSet, iconRequest, usagePanel } = resolveOptions(opts)
    if (!enabled) return config

    const iconSlug = icon.slug ?? 'icon'
    const additions: CollectionConfig[] = [Icon(icon)]
    if (iconSet !== false) additions.push(createIconSetCollection({ iconSlug, usagePanel, ...iconSet }))
    if (iconRequest !== false) additions.push(createIconRequestCollection(iconRequest))

    const marker: PayloadIconsMarker = {
      options: opts,
      iconSlug,
      iconSetSlug: iconSet !== false ? (iconSet.slug ?? ICON_SET_SLUG) : null,
      iconRequestSlug: iconRequest !== false ? ICON_REQUEST_SLUG : null,
    }

    return {
      ...config,
      collections: [...(config.collections ?? []), ...additions],
      endpoints: iconRequest !== false ? [...(config.endpoints ?? []), createClearIconRequestsEndpoint()] : config.endpoints,
      custom: { ...config.custom, payloadIcons: marker },
    }
  }

export default iconsPlugin

import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import { resolveOptions } from './options'
import { createIconSetCollection } from './collections/IconSet'
import { assertNoFieldCollisions, mergeCollection } from './_kit'
import type { CollectionOption } from './_kit'
import type { IconsPluginOptions, PayloadIconsMarker } from './types'
import { createIconRequestCollection } from './collections/IconRequest'
import { createClearIconRequestsEndpoint } from './endpoints/clearIconRequests'

const PLUGIN = 'payload-icons'

// Every collection goes through here, so the collision check can't be forgotten on one of them, and
// the resolved slug is read back off the merged config instead of re-derived at each use site.
// `key` is the `collections` key the reader typed — the collision error has to name where they'd go
// and edit, which a renamed slug isn't. `slug` and `overrides` are the Payload-facing halves of the
// entry; `options` (this plugin's own knobs) is consumed by the caller, not the merge.
const register = <O>(key: string, base: CollectionConfig, opt: CollectionOption<O>): CollectionConfig => {
  const { slug, overrides } = opt
  assertNoFieldCollisions(PLUGIN, key, base.fields, overrides?.fields)
  return mergeCollection(base, { ...overrides, ...(slug ? { slug } : {}) })
}

/** Your own icon set in Payload: upload an `.svg` and it's optimized, sanitized, and themed to
 * `currentColor` on save, then rendered by `<Icon name="…">`.
 *
 * - `enabled`
 * - `collections`
 */
export const iconsPlugin =
  (opts: IconsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const { enabled, collections } = resolveOptions(opts)
    if (!enabled) return config

    const { icon, iconSet, iconRequest } = collections

    const iconConfig = register('icon', Icon(), icon)
    const iconSlug = iconConfig.slug
    const iconSetConfig = iconSet === false ? null : register('iconSet', createIconSetCollection({ iconSlug, ...iconSet.options }), iconSet)
    const iconRequestConfig = iconRequest === false ? null : register('iconRequest', createIconRequestCollection(), iconRequest)

    const additions: CollectionConfig[] = [iconConfig]
    if (iconSetConfig) additions.push(iconSetConfig)
    if (iconRequestConfig) additions.push(iconRequestConfig)

    const marker: PayloadIconsMarker = {
      options: opts,
      iconSlug,
      iconSetSlug: iconSetConfig?.slug ?? null,
      iconRequestSlug: iconRequestConfig?.slug ?? null,
    }

    return {
      ...config,
      collections: [...(config.collections ?? []), ...additions],
      endpoints: iconRequestConfig ? [...(config.endpoints ?? []), createClearIconRequestsEndpoint(iconRequestConfig.slug)] : config.endpoints,
      custom: { ...config.custom, payloadIcons: marker },
    }
  }

export default iconsPlugin

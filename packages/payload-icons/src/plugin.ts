import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import { createIconRequestCollection, ICON_REQUEST_SLUG } from './collections/IconRequest'
import { createIconSetCollection, ICON_SET_SLUG } from './collections/IconSet'
import { stashConfig, stashIconSetSlug } from './lib/getPayloadClient'
import type { IconsPluginOptions } from './types'

/**
 * Payload plugin that contributes the `icon` upload collection and (by default)
 * the `iconSet` grouping collection.
 *
 * - **`icon`** — single-SVG uploads, optimized + sanitized + themed on save
 *   (`formatSVGHook`), stored as an inline `svgString`.
 * - **`iconSet`** — named `name → icon` mappings with a single-active toggle and
 *   drafts/versions. The frontend renders the active set, so activating a
 *   different set re-skins every icon at once.
 * - **`iconRequest`** (on by default; {@link IconsPluginOptions.trackRequests} `false` to omit) —
 *   runtime miss diagnostics surfaced in the IconSet usage panel.
 *
 * Self-contained: no `@pro-laico/core` / `@pro-laico/atomic` dependency. The
 * single-active invariant is a small status-lane-scoped `beforeChange` hook.
 * Revalidation is left to the consumer (wire `revalidatePath` / `revalidateTag`
 * via `iconSetOverrides.hooks`).
 *
 * @example
 * ```ts
 * import { buildConfig } from 'payload'
 * import { iconsPlugin } from '@pro-laico/payload-icons'
 *
 * export default buildConfig({ plugins: [iconsPlugin()] })
 * ```
 */
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

    // Stash the resolved iconSet slug at config-build time so the cache resolver (`./cache`)
    // honors `iconSetOverrides.slug` — any process that loads the config runs this.
    stashIconSetSlug(iconSetOverrides?.slug ?? ICON_SET_SLUG)

    const additions: CollectionConfig[] = [Icon(iconOverrides)]
    if (includeIconSet) additions.push(createIconSetCollection({ iconSlug: iconOverrides?.slug ?? 'icon', usagePanel, ...iconSetOverrides }))
    if (trackRequests) additions.push(createIconRequestCollection(iconRequestOverrides))

    return {
      ...config,
      collections: [...(config.collections ?? []), ...additions],
      // Stash the resolved slugs so decoupled tooling (e.g. @pro-laico/payload-dev-tools) can
      // discover the plugin and read them from just `payload.config` — no import.
      custom: {
        ...config.custom,
        payloadIcons: {
          options: opts,
          iconSlug: iconOverrides?.slug ?? 'icon',
          iconSetSlug: includeIconSet ? (iconSetOverrides?.slug ?? ICON_SET_SLUG) : null,
          iconRequestSlug: trackRequests ? ICON_REQUEST_SLUG : null,
        },
      },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        // Remember the app's config so the server components (<Icon> et al) resolve it from
        // globalThis — no `@payload-config` alias (and thus no transpilePackages) required
        // once Payload has booted.
        stashConfig(payload.config)
      },
    }
  }

export default iconsPlugin

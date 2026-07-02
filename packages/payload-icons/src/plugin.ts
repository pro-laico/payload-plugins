import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import { createIconRequestCollection, type IconRequestCollectionOverrides } from './collections/IconRequest'
import { createIconSetCollection, type IconSetCollectionOverrides } from './collections/IconSet'
import { stashConfig } from './lib/getPayloadClient'
import type { IconCollectionOverrides } from './types'

/**
 * Options for {@link iconsPlugin}. Composes the `icon` upload collection, the
 * `iconSet` grouping collection, and the `iconRequest` diagnostic collection.
 * The usage panel and request tracking are on by default.
 *
 * @example
 * ```ts
 * iconsPlugin({
 *   iconOverrides: { fields: [{ name: 'note', type: 'text' }] },
 *   trackRequests: false, // omit the iconRequest collection
 * })
 * ```
 */
export interface IconsPluginOptions {
  /**
   * When `false`, the plugin is a no-op — no collections are registered. Useful
   * behind a feature flag. @default true
   */
  enabled?: boolean
  /**
   * Overrides for the `icon` upload collection — replaces slug, adminGroup, access,
   * and upload config, and extends `fields` / `hooks`. See {@link IconCollectionOverrides}.
   */
  iconOverrides?: IconCollectionOverrides
  /**
   * When `false`, the `iconSet` collection is not registered (only `icon`). Use
   * when you want icons in the CMS but not the grouping/active-set concept.
   * @default true
   */
  includeIconSet?: boolean
  /**
   * Overrides for the `iconSet` collection — live preview, additive hooks,
   * set-level fields, per-row fields, a drafts toggle. See
   * {@link IconSetCollectionOverrides}.
   */
  iconSetOverrides?: IconSetCollectionOverrides
  /**
   * The IconSet "Requested icons" panel — shows which icons your code needs
   * versus what a set provides (scanned live in dev, from the manifest in prod,
   * plus runtime misses when {@link trackRequests}). Set `false` to omit it.
   * @default true
   */
  usagePanel?: boolean
  /**
   * Registers the `iconRequest` diagnostic collection AND makes the `<Icon>`
   * server component record every name that fails to resolve at runtime —
   * throttled, deferred via `after()`, fire-and-forget. These misses (including
   * dynamic `name={…}` ones a static scan can't see) surface in the usage panel.
   * Set `false` to omit it, or force-disable only the recorder at runtime with
   * `ICON_USAGE_TRACKING=false`.
   * @default true
   */
  trackRequests?: boolean
  /**
   * Overrides for the `iconRequest` collection. Only meaningful when
   * {@link trackRequests} isn't `false`.
   */
  iconRequestOverrides?: IconRequestCollectionOverrides
}

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

    const additions: CollectionConfig[] = [Icon(iconOverrides)]
    if (includeIconSet) additions.push(createIconSetCollection({ iconSlug: iconOverrides?.slug ?? 'icon', usagePanel, ...iconSetOverrides }))
    if (trackRequests) additions.push(createIconRequestCollection(iconRequestOverrides))

    return {
      ...config,
      collections: [...(config.collections ?? []), ...additions],
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

import type { CollectionConfig, Config, Plugin } from 'payload'

import { Icon } from './collections/Icon'
import { createIconRequestCollection, type IconRequestCollectionOverrides } from './collections/IconRequest'
import { createIconSetCollection, type IconSetCollectionOverrides } from './collections/IconSet'
import type { IconCollectionOverrides } from './types'

/**
 * Options for {@link iconsPlugin}. Composes the `icon` upload collection, the
 * `iconSet` grouping collection, and (optionally) the `iconRequest` diagnostic
 * collection.
 *
 * @example
 * ```ts
 * iconsPlugin({
 *   iconOverrides: { fields: [{ name: 'note', type: 'text' }] },
 *   iconSetOverrides: { usagePanel: true },
 *   trackRequests: true,
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
   * set-level fields, per-row fields, the usage panel. See
   * {@link IconSetCollectionOverrides}.
   */
  iconSetOverrides?: IconSetCollectionOverrides
  /**
   * When `true`, registers the `iconRequest` diagnostic collection AND the
   * `<Icon>` server component records every name that fails to resolve at
   * runtime — throttled, deferred via `after()`, fire-and-forget. These live
   * misses (including dynamic `name={…}` ones a static scan can't see) surface
   * in the IconSet "Requested icons" panel alongside the build-time manifest.
   *
   * Force-disable the recorder at runtime with `ICON_USAGE_TRACKING=false`.
   * @default false
   */
  trackRequests?: boolean
  /**
   * Overrides for the `iconRequest` collection. Only meaningful when
   * {@link trackRequests} is `true`.
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
 *   drafts/versions. The frontend `<Icon name>` resolves through the active set,
 *   so swapping it re-skins every icon.
 * - **`iconRequest`** (opt-in via {@link IconsPluginOptions.trackRequests}) —
 *   runtime miss diagnostics surfaced in the IconSet usage panel.
 *
 * Self-contained: no `@pro-laico/core` / `@pro-laico/atomic` dependency. The
 * active toggle is a plain checkbox guarded by a single-active hook, and
 * revalidation is left to the consumer (wire `revalidatePath` / `revalidateTag`
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
    const { enabled = true, iconOverrides, includeIconSet = true, iconSetOverrides, trackRequests = false, iconRequestOverrides } = opts
    if (!enabled) return config

    const additions: CollectionConfig[] = [Icon(iconOverrides)]
    if (includeIconSet) {
      additions.push(createIconSetCollection({ iconSlug: iconOverrides?.slug ?? 'icon', ...iconSetOverrides }))
    }
    if (trackRequests) additions.push(createIconRequestCollection(iconRequestOverrides))

    return { ...config, collections: [...(config.collections ?? []), ...additions] }
  }

export default iconsPlugin

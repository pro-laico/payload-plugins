import type { IconCollectionOverrides } from '../collections/icon-collection'
import type { IconRequestCollectionOverrides } from '../collections/icon-request-collection'
import type { IconSetCollectionOverrides } from '../collections/icon-set-collection'

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

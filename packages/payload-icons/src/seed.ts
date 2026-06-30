/**
 * Seed integration glue for `@pro-laico/payload-seed`. Plain configuration — this module imports
 * NEITHER the seed package NOR svgo, so the two plugins stay decoupled. The `icon` collection is
 * a standard Payload upload collection, so it seeds natively: each SVG is uploaded through the
 * normal seed flow (running `formatSVGHook`, which optimizes it) — no custom script, no asset
 * provider needed.
 *
 * `iconAssets()` builds the `defineAssets` spec map; drop your source `.svg` files in the seed
 * assets dir (the loader searches the `svg/` subdir, so `assets/svg/arrow-right.svg` resolves
 * from `'arrow-right.svg'`).
 */

import type { CollectionSlug } from 'payload'
import { ICON_SLUG } from './collections/Icon'

/** One source-icon spec. Structurally compatible with the seed plugin's `AssetSpec`, so it feeds
 *  straight into `defineAssets` — `collection` is typed as `CollectionSlug` (which resolves to the
 *  consuming app's slug union), not a bare `string`. */
export interface IconAssetSpec {
  /** Filename within the seed assets dir (searched under `svg/`, `images/`, … and the root). */
  file: string
  /** Upload collection — the icon slug. */
  collection: CollectionSlug
  /** Extra fields to set on the created icon doc. */
  data?: Record<string, unknown>
}

export interface IconAssetsOptions {
  /** The icon collection slug (match the plugin's `slug` if you renamed it). @default 'icon' */
  collection?: CollectionSlug
  /** Extra fields applied to every created icon doc. */
  data?: Record<string, unknown>
}

/** Derive an `asset()` key from a filename: drop the directory and `.svg` extension
 *  (`brand/arrow-right.svg` → `arrow-right`). */
const iconKey = (file: string): string => file.replace(/^.*[\\/]/, '').replace(/\.svg$/i, '')

/**
 * Build a `defineAssets` spec map for a set of SVG files, each pre-targeted at the `icon`
 * collection. Pass the result straight to the seed plugin's `defineAssets`:
 *
 * @example
 * ```ts
 * import { defineAssets } from '@pro-laico/payload-seed'
 * import { iconAssets } from '@pro-laico/payload-icons'
 *
 * // assets/svg/arrow-right.svg, assets/svg/check.svg
 * export default defineAssets(iconAssets(['arrow-right.svg', 'check.svg']))
 * // each is referenceable as asset('arrow-right') / asset('check')
 * ```
 */
export const iconAssets = (files: string[], options: IconAssetsOptions = {}): Record<string, IconAssetSpec> => {
  const collection = options.collection ?? (ICON_SLUG as CollectionSlug)
  return Object.fromEntries(files.map((file) => [iconKey(file), { file, collection, ...(options.data ? { data: options.data } : {}) }]))
}

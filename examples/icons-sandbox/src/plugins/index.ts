import { iconsPlugin } from '@pro-laico/payload-icons'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import iconSets from '../seed/iconSets'
import icons from '../seed/icons'
import pages from '../seed/pages'

// The project's plugin barrel — payload.config imports this array.
//
// iconsPlugin: zero-config. Registers the `icon` SVG-upload collection (optimizes + sanitizes every
// SVG on save, stores it as an inline `svgString`) and the `iconSet` collection — named `name → icon`
// mappings with a single-active toggle. `<Icon name>` on the frontend resolves through the active
// set, so activating a different set re-skins every icon. The "Requested icons" usage panel and
// runtime miss tracking (`iconRequest`) are on by default.
//
// seedPlugin: the `icon` collection seeds NATIVELY as a standard upload collection — the `icons`
// definition is a plain `defineAssets({ ... })` targeting `icon`; the engine uploads each SVG from
// `seed-assets/svg/` (running the optimize hook). `iconSets` then seeds an active set referencing
// those icons, and a page references one via `asset(...)`. Set ENABLE_SEED=true, then use the admin
// button or POST /api/seed.
export const plugins: Plugin[] = [
  iconsPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [icons, iconSets, pages],
    assets: { dir: 'seed-assets', collection: 'icon' },
  }),
]

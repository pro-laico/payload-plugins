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
// seedPlugin: the `icon` collection is a standard upload collection, so icons seed NATIVELY — no
// asset provider (unlike payload-mux, whose `mux-video` ingests to an external service). `icons`
// is just `defineSeed('icon', …)` with each SVG on its `_file` meta-key; the engine uploads each
// from `seed-assets/icon/` through the normal flow (running the optimize hook). `iconSets` then
// seeds an active `iconSet` referencing those icons via `ref('icon', …)`, and a page references one
// via `ref('icon', …)`. Set ENABLE_SEED=true, then use the admin button or POST /api/seed.
export const plugins: Plugin[] = [
  iconsPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [icons, iconSets, pages],
    assetsDir: 'seed-assets',
  }),
]

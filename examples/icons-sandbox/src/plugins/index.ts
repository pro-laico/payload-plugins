import { iconsPlugin } from '@pro-laico/payload-icons'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import icons from '../seed/icons'
import pages from '../seed/pages'

// The project's plugin barrel — payload.config imports this array.
//
// iconsPlugin: no options needed — it registers the `icon` SVG-upload collection, which optimizes
// + sanitizes every SVG on save and stores it as an inline `svgString`.
//
// seedPlugin: the `icon` collection is a standard upload collection, so icons seed NATIVELY — no
// asset provider (unlike payload-mux, whose `mux-video` ingests to an external service). `icons`
// is just `defineCollectionSeed('icon', …)` with each SVG on its `_file` meta-key; the engine
// uploads each from `seed-assets/svg/` through the normal flow (running the optimize hook), and a
// page references one via `ref('icon', …)`. Set ENABLE_SEED=true, then use the admin button or POST /api/seed.
export const plugins: Plugin[] = [
  iconsPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [icons, pages],
    assetsDir: 'seed-assets',
  }),
]

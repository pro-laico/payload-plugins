import { fontAssetProvider, fontsPlugin } from '@pro-laico/payload-fonts'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import fonts from '../seed/fonts'
import fontSet from '../seed/fontSet'

// The seed definitions, shared by the seed plugin (the admin button / POST /api/seed) and the
// integration test. `fonts` declares four typefaces, each with its file on the `_file` meta-key;
// `fontSet` wires the active selection with ordinary `ref('font', …)` tokens.
export const seedDefinitions = [fonts, fontSet]

// The project's plugin barrel — payload.config imports this array.
//
// fontsPlugin: no args needed — registers `font` + the hidden `fontOriginal`/`fontOptimized`
// upload collections, the `fontSet` global (the active selection, on by default), and the
// GET /api/fonts/export endpoint. The save hook subsets each uploaded original to a served WOFF2.
//
// seedPlugin: registers `font` as an asset provider, so a typeface seeds like any doc — declared
// with `_file: file('inter.woff2', { weight })` and run by the normal seed flow (POST /api/seed or
// the admin button). Source files live in `seed-assets/fonts/`.
export const plugins: Plugin[] = [
  fontsPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: seedDefinitions,
    assetsDir: 'seed-assets',
    assetProviders: [fontAssetProvider()],
  }),
]

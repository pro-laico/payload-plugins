import { fontsPlugin } from '@pro-laico/payload-fonts'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import fonts, { fontOriginals } from '../seed/fonts'
import fontSet from '../seed/fontSet'

// The seed definitions, shared by the seed plugin (the admin button / POST /api/seed) and the
// integration test. `fontOriginals` uploads the raw font files into the `fontOriginal` archive;
// `fonts` declares four typefaces that ref those originals; `fontSet` wires the active selection
// with ordinary `ref('font', …)` tokens.
export const seedDefinitions = [fontOriginals, fonts, fontSet]

// The project's plugin barrel — payload.config imports this array.
//
// fontsPlugin: no args needed — registers `font` + the hidden `fontOriginal`/`fontOptimized`
// upload collections, the `fontSet` global (the active selection, on by default), and the
// GET /api/fonts/export endpoint. The save hook subsets each uploaded original to a served WOFF2.
//
// seedPlugin: no asset-provider glue — `fontOriginal` is a plain upload collection, so the raw
// font files seed natively and each typeface just refs its original. `assetSubDirs` points the
// `fontOriginal` lookups at `seed-assets/font/` (a friendlier folder name than the slug).
export const plugins: Plugin[] = [
  fontsPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: seedDefinitions,
    assetsDir: 'seed-assets',
    assetSubDirs: { fontOriginal: 'font' },
  }),
]

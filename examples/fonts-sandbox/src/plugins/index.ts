import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { fontsPlugin } from '@pro-laico/payload-fonts'

import fontSet from '../seed/fontSet'
import fonts, { fontOriginals } from '../seed/fonts'

export const seedDefinitions = [fontOriginals, fonts, fontSet]

export const plugins: Plugin[] = [
  fontsPlugin(),
  seedPlugin({ definitions: seedDefinitions, options: { assetsDir: 'seed-assets', assetSubDirs: { fontOriginal: 'font' } } }),
]

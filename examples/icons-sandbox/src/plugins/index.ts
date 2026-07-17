import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { iconsPlugin } from '@pro-laico/payload-icons'

import icons from '../seed/icons'
import pages from '../seed/pages'
import iconSets from '../seed/iconSets'

export const plugins: Plugin[] = [iconsPlugin(), seedPlugin({ definitions: [icons, iconSets, pages], options: { assetsDir: 'seed-assets' } })]

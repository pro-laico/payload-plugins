import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'

import icons from '../seed/icons'
import pages from '../seed/pages'
import iconSets from '../seed/iconSets'

export const plugins: Plugin[] = [
  iconsPlugin(),
  seedPlugin({ definitions: [icons, iconSets, pages], options: { assetsDir: 'seed-assets' } }),
  // Not optional dressing: `<Icon>` caches its active-set read and tags it `payload-icons`, and the
  // icon collections declare that tag through `custom.revalidate.extraTags`. This is the half that
  // reads the marker and busts it — without it, uploading an SVG or activating a different set
  // changes nothing on screen until the cache entry expires.
  revalidatePlugin({ options: { observe: process.env.NODE_ENV !== 'production' } }),
]

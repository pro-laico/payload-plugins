import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { sandboxCachePlugin } from '@pro-laico/sandbox-shell/cache'
import { imagesPlugin } from '@pro-laico/payload-images'

import pages from '../seed/pages'
import images from '../seed/images'

export const plugins: Plugin[] = [
  imagesPlugin(),
  seedPlugin({ definitions: [images, pages], options: { assetsDir: 'seed-assets' } }),
  // Busts the one tag every getter in @/lib/getters reads under.
  sandboxCachePlugin(),
]

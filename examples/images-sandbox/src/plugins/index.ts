import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { imagesPlugin } from '@pro-laico/payload-images'

import pages from '../seed/pages'
import images from '../seed/images'

export const plugins: Plugin[] = [
  imagesPlugin({ prewarm: true }),
  seedPlugin({ adminButton: true, definitions: [images, pages], assetsDir: 'seed-assets' }),
]

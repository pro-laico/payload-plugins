import { imagesPlugin } from '@pro-laico/payload-images'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import images from '../seed/images'
import pages from '../seed/pages'

export const plugins: Plugin[] = [
  imagesPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [images, pages],
    assetsDir: 'seed-assets',
  }),
]

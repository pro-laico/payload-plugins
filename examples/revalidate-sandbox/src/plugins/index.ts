import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { imagesPlugin } from '@pro-laico/payload-images'
import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'

import iconsSeed from '../seed/icons'
import mediaSeed from '../seed/media'
import imagesSeed from '../seed/images'
import iconSetsSeed from '../seed/iconSets'
import postsSeed from '../collections/Posts/seed'
import servicesSeed from '../collections/Services/seed'
import siteSettingsSeed from '../globals/SiteSettings/seed'

export const seedOptions = { definitions: [mediaSeed, imagesSeed, iconsSeed, iconSetsSeed, servicesSeed, postsSeed, siteSettingsSeed] }

export const plugins: Plugin[] = [
  seedPlugin(seedOptions),
  devToolsPlugin(),
  iconsPlugin(),
  imagesPlugin(),
  revalidatePlugin({
    observe: process.env.NODE_ENV !== 'production',
    collections: { posts: { lists: { featured: ['featured'] } } },
  }),
]

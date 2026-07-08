import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { imagesPlugin } from '@pro-laico/payload-images'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import postsSeed from '../collections/Posts/seed'
import servicesSeed from '../collections/Services/seed'
import siteSettingsSeed from '../globals/SiteSettings/seed'
import iconSetsSeed from '../seed/iconSets'
import iconsSeed from '../seed/icons'
import imagesSeed from '../seed/images'
import mediaSeed from '../seed/media'

// Exported so the integration test drives the same seed the admin button / POST /api/seed runs.
export const seedOptions = { definitions: [mediaSeed, imagesSeed, iconsSeed, iconSetsSeed, servicesSeed, postsSeed, siteSettingsSeed] }

export const plugins: Plugin[] = [
  seedPlugin({ ...seedOptions, adminButton: true }),
  devToolsPlugin(),
  // Sibling plugins, wired with ZERO revalidation config: their collections ship data-only
  // `custom.revalidate` markers (icon/iconSet carry the shared `payload-icons` extraTag,
  // iconRequest opts out entirely), and revalidatePlugin below picks them up automatically.
  iconsPlugin(),
  imagesPlugin(),
  // LAST, so collections contributed by other plugins get revalidation hooks too.
  // `observe` is widened from its dev-only default so the integration tests can assert
  // against the recorded events. The 'featured' list scope declares its determinant
  // field, so flipping `featured` busts posts:list:featured — and nothing else.
  revalidatePlugin({
    observe: process.env.NODE_ENV !== 'production',
    collections: { posts: { lists: { featured: { fields: ['featured'] } } } },
  }),
]

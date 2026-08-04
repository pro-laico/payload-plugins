import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { fontsPlugin } from '@pro-laico/payload-fonts'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { muxPlugin } from '@pro-laico/payload-mux'
import { imagesPlugin } from '@pro-laico/payload-images'
import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'
import team from '../seed/team'
import icons from '../seed/icons'
import images from '../seed/images'
import videos from '../seed/videos'
import folders from '../seed/folders'
import fontSet from '../seed/fontSet'
import iconSets from '../seed/iconSets'
import projects from '../seed/projects'
import services from '../seed/services'
import siteSettings from '../seed/siteSettings'
import testimonials from '../seed/testimonials'
import fonts, { fontOriginals } from '../seed/fonts'

export const seedDefinitions = [
  fontOriginals,
  fonts,
  fontSet,
  icons,
  iconSets,
  folders,
  images,
  services,
  projects,
  team,
  testimonials,
  siteSettings,
  videos,
]

export const seedOptions = { definitions: seedDefinitions, options: { assetsDir: 'seed-assets', assetSubDirs: { fontOriginal: 'font' } } }

export const plugins: Plugin[] = [
  // A non-default prewarm strategy: seed the hero crop before any traffic is observed, and run
  // queued jobs nightly. autoRun is an in-process cron — it needs a long-lived server; on
  // serverless drive the queue from a cron hitting /api/payload-jobs/run instead.
  imagesPlugin({ options: { prewarm: { strategy: { seeds: [{ aspectRatio: '16:9', quality: 80 }], autoRun: '0 3 * * *' } } } }),
  iconsPlugin(),
  muxPlugin(),
  fontsPlugin(),
  seedPlugin(seedOptions),
  devToolsPlugin(),
  revalidatePlugin({
    collections: {
      services: { lists: { ordered: ['order'] } },
      projects: { lists: { work: ['featured', 'year'], featured: ['featured'] } },
      team: { lists: { ordered: ['order'] } },
    },
  }),
]

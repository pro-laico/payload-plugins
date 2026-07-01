import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import postsSeed from '../collections/Posts/seed'
import servicesSeed from '../collections/Services/seed'
import siteSettingsSeed from '../globals/SiteSettings/seed'
import mediaSeed from '../seed/media'

// The seed config — exported so the integration test can drive the same seed the admin button /
// POST /api/seed runs. `media` is a native upload collection, so its docs seed with a `_file`.

export const plugins: Plugin[] = [
  seedPlugin({
    definitions: [mediaSeed, servicesSeed, postsSeed, siteSettingsSeed],
    adminButton: true,
  }),
]

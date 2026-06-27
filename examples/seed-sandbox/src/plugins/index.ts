import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import postsSeed from '../collections/Posts/seed'
import servicesSeed from '../collections/Services/seed'
import siteSettingsSeed from '../globals/SiteSettings/seed'
import assetsSeed from '../seed/assets'

// The project's plugin barrel — payload.config imports this array. Seed definitions are
// imported here and handed to seedPlugin, which uses them for both the in-app endpoint and
// the typed `SeedRegistry` injected into payload-types.ts (via typescript.postProcess).
export const seedDefinitions = [assetsSeed, servicesSeed, postsSeed, siteSettingsSeed]

export const plugins: Plugin[] = [
  seedPlugin({
    enabled: true,
    assets: { dir: 'assets', collection: 'media' },
    adminButton: true,
    definitions: seedDefinitions,
  }),
]

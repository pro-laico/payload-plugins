import type { SeedDefinition } from '@pro-laico/payload-seed'
import postsSeed from '@/collections/Posts/seed'
import servicesSeed from '@/collections/Services/seed'
import siteSettingsSeed from '@/globals/SiteSettings/seed'
import assetsSeed from './assets'

// Explicit definition barrel. Auto-discovery (globbing seed.ts) works for the Local API /
// CLI / test paths, but the bundled Next server can't dynamically import source files at
// runtime — so the in-app endpoint is fed these explicitly. (A future `payload-seed
// generate` step will write this barrel automatically.)
export const definitions: SeedDefinition[] = [assetsSeed, servicesSeed, postsSeed, siteSettingsSeed]

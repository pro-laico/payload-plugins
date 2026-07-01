import { defineGlobalSeed } from '@pro-laico/payload-seed'

export default defineGlobalSeed('site-settings', ({ ref }) => ({
  siteName: 'Seed Sandbox',
  logo: ref('media', 'logo'),
  featuredService: ref('services', 'implementation'),
}))

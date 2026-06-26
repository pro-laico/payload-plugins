import { defineGlobalSeed } from '@pro-laico/payload-seed'

export default defineGlobalSeed('site-settings', ({ ref, asset }) => ({
  siteName: 'Seed Sandbox',
  logo: asset('logo'),
  featuredService: ref('services', 'implementation'),
}))

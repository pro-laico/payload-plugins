import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('site-settings', ({ ref }) => ({
  siteName: 'Seed Sandbox',
  logo: ref('media', 'logo'),
  featuredService: ref('services', 'implementation'),
}))

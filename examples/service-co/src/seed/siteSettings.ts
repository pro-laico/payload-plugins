import { defineSeed } from '@pro-laico/payload-seed'

// Site-wide content. `heroImage` and `featuredProject` point at seeded docs via `ref()` tokens.
// `showreel` is intentionally left unseeded — Mux needs credentials, and the dev server regenerates
// the seed-ref types on boot without them, so a `ref('mux-video', …)` here wouldn't be type-stable.
// With creds, videos.ts ingests a standalone clip; attach it here (Site Settings → Showreel) in the
// admin and the home hero plays it. Otherwise the hero falls back to the static image.
export default defineSeed('site-settings', ({ ref }) => ({
  companyName: 'Meridian',
  tagline: 'We design and build places worth staying in.',
  description:
    'Meridian is a design-build studio working across architecture, interiors, and landscape. We take on a small number ' +
    'of projects a year and see each one through from the first sketch to the last detail.',
  heroImage: ref('images', 'hero'),
  featuredProject: ref('projects', 'cedar-hill-residence'),
  contact: {
    email: 'studio@meridian.example',
    phone: '+1 (303) 555-0142',
    address: '1200 Pearl Street, Boulder, CO 80302',
  },
}))

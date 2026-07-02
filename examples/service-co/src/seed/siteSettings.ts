import { defineSeed } from '@pro-laico/payload-seed'

// Site-wide content. `heroImage`, `showreel`, and `featuredProject` point at seeded docs via
// `ref()` tokens. `showreel` targets the Mux clip: without MUX_TOKEN_ID / MUX_TOKEN_SECRET the
// engine skips the videos definition and drops this field (the home hero falls back to the static
// image); with them, the clip ingests and the ref wires up automatically.
export default defineSeed('site-settings', ({ ref }) => ({
  companyName: 'Meridian',
  tagline: 'We design and build places worth staying in.',
  description:
    'Meridian is a design-build studio working across architecture, interiors, and landscape. We take on a small number ' +
    'of projects a year and see each one through from the first sketch to the last detail.',
  heroImage: ref('images', 'hero'),
  showreel: ref('mux-video', 'showreel'),
  featuredProject: ref('projects', 'cedar-hill-residence'),
  contact: {
    email: 'studio@meridian.example',
    phone: '+1 (303) 555-0142',
    address: '1200 Pearl Street, Boulder, CO 80302',
  },
}))

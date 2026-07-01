import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ ref }) => [
  {
    _key: 'consulting',
    title: 'Consulting',
    slug: 'consulting',
    summary: 'Strategic guidance tailored to your goals.',
    image: ref('media', 'serviceA'),
    // Circular: each service references the other. The engine breaks the cycle by deferring one
    // side's `related` and setting it after both docs exist.
    related: [ref('services', 'implementation')],
  },
  {
    _key: 'implementation',
    title: 'Implementation',
    slug: 'implementation',
    summary: 'Hands-on delivery, done right the first time.',
    image: ref('media', 'serviceB'),
    related: [ref('services', 'consulting')],
  },
])

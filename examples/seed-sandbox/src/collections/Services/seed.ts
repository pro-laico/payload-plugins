import { defineCollectionSeed } from '@pro-laico/payload-seed'

export default defineCollectionSeed('services', ({ ref }) => [
  {
    _key: 'consulting',
    title: 'Consulting',
    slug: 'consulting',
    summary: 'Strategic guidance tailored to your goals.',
    image: ref('media', 'serviceA'),
  },
  {
    _key: 'implementation',
    title: 'Implementation',
    slug: 'implementation',
    summary: 'Hands-on delivery, done right the first time.',
    image: ref('media', 'serviceB'),
  },
])

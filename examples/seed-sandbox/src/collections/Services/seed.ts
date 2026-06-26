import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ asset }) => [
  {
    _key: 'consulting',
    title: 'Consulting',
    slug: 'consulting',
    summary: 'Strategic guidance tailored to your goals.',
    image: asset('serviceA'),
  },
  {
    _key: 'implementation',
    title: 'Implementation',
    slug: 'implementation',
    summary: 'Hands-on delivery, done right the first time.',
    image: asset('serviceB'),
  },
])

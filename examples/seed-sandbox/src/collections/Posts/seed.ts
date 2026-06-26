import { defineSeed } from '@pro-laico/payload-seed'

// Demonstrates a cross-file reference: this post depends on the 'consulting' service
// seeded in ../../collections/Services/seed.ts. The engine records that edge, orders
// services before posts, and resolves the ref to the created service's id.
export default defineSeed('posts', ({ ref, asset }) => [
  {
    _key: 'launch',
    title: 'We launched',
    slug: 'we-launched',
    excerpt: 'Announcing our new consulting practice.',
    heroImage: asset('post'),
    relatedService: ref('services', 'consulting'),
  },
])

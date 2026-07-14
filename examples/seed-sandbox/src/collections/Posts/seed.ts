import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('posts', ({ ref }) => [
  {
    _key: 'launch',
    title: 'We launched',
    slug: 'we-launched',
    excerpt: 'Announcing our new consulting practice.',
    heroImage: ref('media', 'post'),
    relatedService: ref('services', 'consulting'),
  },
])

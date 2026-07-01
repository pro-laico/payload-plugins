import { defineCollectionSeed } from '@pro-laico/payload-seed'

// The media library, seeded like any other collection: each doc carries its source file on the
// `_file` meta-key (uploaded natively since `media` is an upload collection) and is referenceable
// elsewhere via ref('media', <_key>). Files live in `assets/image/`.
export default defineCollectionSeed('media', ({ file }) => [
  { _key: 'serviceA', _file: file('service-a.jpg'), alt: 'Consulting service' },
  { _key: 'serviceB', _file: file('service-b.jpg'), alt: 'Implementation service' },
  { _key: 'post', _file: file('post-cover.jpg'), alt: 'Blog post cover' },
  { _key: 'logo', _file: file('logo.jpg'), alt: 'Brand logo' },
])

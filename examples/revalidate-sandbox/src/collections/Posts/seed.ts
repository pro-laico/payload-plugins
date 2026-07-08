import { defineSeed } from '@pro-laico/payload-seed'

/** A paragraph followed by an embedded upload node — the runtime walk finds the
 *  `{ relationTo, value }` inside the Lexical tree and tags the media doc. */
const body = (imageRef: unknown) => ({
  root: {
    type: 'root',
    direction: null,
    format: '' as const,
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        direction: null,
        format: '' as const,
        indent: 0,
        version: 1,
        children: [{ type: 'text', text: 'Announcing our new consulting practice.', version: 1 }],
      },
      { type: 'upload', relationTo: 'media', value: imageRef, version: 1 },
    ],
  },
})

export default defineSeed('posts', ({ ref }) => [
  {
    _key: 'launch',
    _status: 'published',
    featured: true,
    title: 'We launched',
    slug: 'we-launched',
    excerpt: 'Announcing our new consulting practice.',
    heroImage: ref('media', 'post'),
    relatedService: ref('services', 'consulting'),
    body: body(ref('media', 'serviceA')) as never,
  },
])

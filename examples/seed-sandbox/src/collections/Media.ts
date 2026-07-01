import type { CollectionConfig } from 'payload'

/** Upload collection seeded via `defineCollectionSeed('media', …)`; other docs point at its docs
 *  with `ref('media', …)`. */
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: true,
  fields: [{ name: 'alt', type: 'text' }],
}

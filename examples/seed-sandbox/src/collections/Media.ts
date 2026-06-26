import type { CollectionConfig } from 'payload'

/** Upload collection that the seed's `asset()` references resolve to. */
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: true,
  fields: [{ name: 'alt', type: 'text' }],
}

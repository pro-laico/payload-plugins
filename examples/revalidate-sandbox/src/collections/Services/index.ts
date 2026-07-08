import type { CollectionConfig } from 'payload'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'summary', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    // Optional self-relationship — lets services reference each other, which the seed can express as
    // a circular `ref()` (broken by deferring this field, then set in the engine's second pass).
    { name: 'related', type: 'relationship', relationTo: 'services', hasMany: true },
  ],
}

import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    // References a Services doc — exercised via ref('services', …) in the seed.
    { name: 'relatedService', type: 'relationship', relationTo: 'services' },
  ],
}

import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'relatedService', type: 'relationship', relationTo: 'services' },
    { name: 'body', type: 'richText' },
  ],
}

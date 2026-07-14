import type { CollectionConfig } from 'payload'

/** A portfolio project (case study). This is the collection that exercises the most plugins at
 *  once: a payload-images `coverImage` + `gallery`, an optional payload-mux `video`, and a
 *  many-relationship to the `services` used. `featured` surfaces one project on the home page. */
export const Projects: CollectionConfig = {
  slug: 'projects',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'client', 'year', 'featured'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'client', type: 'text' },
    { name: 'location', type: 'text' },
    { name: 'year', type: 'number' },
    { name: 'summary', type: 'textarea' },
    { name: 'description', type: 'textarea' },
    { name: 'coverImage', label: 'Cover image', type: 'upload', relationTo: 'images' },
    {
      name: 'gallery',
      type: 'array',
      labels: { singular: 'Photo', plural: 'Gallery' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'images', required: true }],
    },
    { name: 'video', label: 'Video', type: 'relationship', relationTo: 'mux-video' },
    { name: 'services', type: 'relationship', relationTo: 'services', hasMany: true },
    { name: 'featured', type: 'checkbox', defaultValue: false },
  ],
}

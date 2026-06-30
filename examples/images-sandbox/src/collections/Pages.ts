import type { CollectionConfig } from 'payload'

/** A minimal content collection that relates to an optimized image — the typical consumer
 *  pattern (link an image to a page via an `upload` field to the plugin's `images`
 *  collection, then render it with `<ResponsiveImage>`). */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'heroImage', label: 'Hero Image', type: 'upload', relationTo: 'images' },
  ],
}

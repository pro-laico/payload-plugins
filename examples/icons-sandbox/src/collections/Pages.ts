import type { CollectionConfig } from 'payload'

/** A minimal content collection that relates to an icon — the typical consumer pattern (attach
 *  an icon to a page/nav item via a `relationship` field to the `icon` collection). */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'icon', label: 'Icon', type: 'relationship', relationTo: 'icon' },
  ],
}

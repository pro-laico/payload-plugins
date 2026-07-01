import type { CollectionConfig } from 'payload'

/** A service the studio offers. Each one relates to a payload-icons `icon` (rendered in the
 *  services grid) and an on-demand payload-images `image`. `order` drives the display sequence. */
export const Services: CollectionConfig = {
  slug: 'services',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'order'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'summary', type: 'textarea' },
    { name: 'icon', label: 'Icon', type: 'relationship', relationTo: 'icon' },
    { name: 'image', label: 'Image', type: 'upload', relationTo: 'images' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}

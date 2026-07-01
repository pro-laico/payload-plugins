import type { CollectionConfig } from 'payload'

/** A person on the team. `photo` is a payload-images upload, rendered as a square focal-aware crop
 *  on the About page. */
export const TeamMembers: CollectionConfig = {
  slug: 'team',
  access: { read: () => true },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'role', 'order'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'text' },
    { name: 'bio', type: 'textarea' },
    { name: 'photo', label: 'Photo', type: 'upload', relationTo: 'images' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}

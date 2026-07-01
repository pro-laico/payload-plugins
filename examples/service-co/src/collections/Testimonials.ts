import type { CollectionConfig } from 'payload'

/** A client testimonial, optionally tied to the `project` it's about (exercises a relationship
 *  seeded via `ref()`). Rendered on the home page. */
export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  access: { read: () => true },
  admin: { useAsTitle: 'author', defaultColumns: ['author', 'company'] },
  fields: [
    { name: 'quote', type: 'textarea', required: true },
    { name: 'author', type: 'text', required: true },
    { name: 'company', type: 'text' },
    { name: 'project', type: 'relationship', relationTo: 'projects' },
  ],
}

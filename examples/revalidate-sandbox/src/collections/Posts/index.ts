import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  // Drafts on: exercises payload-revalidate's lane handling (draft saves bust only
  // `…:draft` variants; publish/unpublish transitions bust both lanes).
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'excerpt', type: 'textarea' },
    // Determinant of the 'featured' list scope — flipping it busts posts:list:featured only.
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    // References a Services doc — a static graph edge, and a dep tag when populated.
    { name: 'relatedService', type: 'relationship', relationTo: 'services' },
    // Lexical body: upload/relationship nodes in here are found by the runtime walk —
    // the case a static registry can never cover.
    { name: 'body', type: 'richText' },
  ],
}

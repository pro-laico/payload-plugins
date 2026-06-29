import type { CollectionConfig } from 'payload'

/** A minimal content collection that relates to a Mux video — the typical consumer pattern
 *  (link a video to a page/post via a `relationship` field to `mux-video`). */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'heroVideo', label: 'Hero Video', type: 'relationship', relationTo: 'mux-video' },
  ],
}

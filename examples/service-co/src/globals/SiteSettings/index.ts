import type { GlobalConfig } from 'payload'

/** Site-wide content: brand name/tagline, contact details, the featured project, and the optional
 *  Mux `showreel` played in the home hero. A global that references collection docs via `ref()`. */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: () => true },
  fields: [
    { name: 'companyName', type: 'text' },
    { name: 'tagline', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'heroImage', label: 'Hero image', type: 'upload', relationTo: 'images' },
    // Optional — needs Mux credentials. The home hero plays this over the hero image when present.
    { name: 'showreel', label: 'Showreel', type: 'relationship', relationTo: 'mux-video' },
    { name: 'featuredProject', type: 'relationship', relationTo: 'projects' },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'text' },
      ],
    },
  ],
}

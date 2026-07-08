import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: () => true },
  fields: [
    { name: 'siteName', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    // A global referencing a collection doc — exercises ref() from a global seed.
    { name: 'featuredService', type: 'relationship', relationTo: 'services' },
  ],
}

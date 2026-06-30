import type { CollectionConfig } from 'payload'

/** Auth collection — needed for admin login and the default write-access gate. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [],
}

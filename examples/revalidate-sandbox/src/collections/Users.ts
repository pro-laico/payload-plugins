import type { CollectionConfig } from 'payload'

/** Auth collection — needed for admin login and to gate the seed endpoint. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [],
}

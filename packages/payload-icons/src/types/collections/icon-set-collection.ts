import type { CollectionConfig } from 'payload'

/** What the base `iconSet` collection needs from the plugin — every value resolved once, in `plugin.ts`. */
export interface IconSetCollectionArgs {
  /** The resolved slug of the `icon` collection each row uploads into. */
  iconSlug: string
  /** Whether to render the "Requested icons" panel on the edit view. */
  usagePanel: boolean
  /** Appended to every row of `iconsArray`, beside the name and the upload. */
  iconRowFields: CollectionConfig['fields']
}

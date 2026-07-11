import type { CollectionConfig, Field } from 'payload'

/**
 * Overrides for {@link createIconRequestCollection}. All additive on top of the
 * built-in `name` / `count` / `firstRequestedAt` / `lastRequestedAt` fields.
 */
export interface IconRequestCollectionOverrides {
  /** Override the `admin.group` sidebar label. @default 'Sets' */
  group?: string
  /** Extra fields appended after the built-ins. */
  fields?: Field[]
  /** Additional Payload hooks merged onto the collection. */
  hooks?: CollectionConfig['hooks']
}

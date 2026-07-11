import type { BuiltModel } from './model'

export interface ValidateArgs {
  model: BuiltModel
  /** Slugs of collections that actually exist in the Payload config. */
  collectionSlugs: Set<string>
  /** Slugs of globals that actually exist in the Payload config. */
  globalSlugs: Set<string>
  /** Slugs that can carry a `_file`: upload collections plus `custom.seedAsset` collections. */
  fileCollections: Set<string>
  /** Valid top-level field names per node (`collection` slug, or `global:<slug>`), from the
   *  live config's `flattenedFields`. When provided, unknown record fields are flagged —
   *  the runtime counterpart to the compile-time exactness check. */
  fieldNames?: Map<string, Set<string>>
}

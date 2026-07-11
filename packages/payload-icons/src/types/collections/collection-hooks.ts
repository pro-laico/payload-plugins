import type { CollectionConfig } from 'payload'

/** A collection's hooks map with the optionality removed — the merge target for `mergeHooks`. */
export type Hooks = NonNullable<CollectionConfig['hooks']>

import type { CollectionSlug, DataFromGlobalSlug, GlobalSlug, RequiredDataFromCollectionSlug } from 'payload'
import type { FileToken, Ref } from '../tokens/tokens'

/**
 * Recursively widens a generated Payload data type so a {@link Ref} may appear at any object
 * field or array element — that's how relationship values are supplied as tokens instead of ids.
 * The shape (field names, required-ness) is still enforced, so changing a collection's schema still
 * surfaces a TS error in its seed file. Files aren't widened in here — they go on the record's
 * `_file` meta-key, not in a data field. Intentionally permissive at the leaf for v1: the runtime
 * validator checks that each ref actually lands in a field whose config allows it.
 */
export type WithRefs<T> = T extends Ref
  ? T
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? Array<WithRefs<U> | Ref>
      : T extends object
        ? { [K in keyof T]: WithRefs<T[K]> | Ref }
        : T

/** A single collection seed record: the collection's create-data, a local `_key` reference
 *  handle, and an optional `_file` attaching a source file (for upload / provider collections). */
export type CollectionSeedData<TSlug extends CollectionSlug> = WithRefs<RequiredDataFromCollectionSlug<TSlug>> & {
  _key: string
  _file?: FileToken
}

/** A global's seed data (globals are singletons — no `_key`). The generated global type
 *  carries `id`/`globalType`/timestamps that `updateGlobal` doesn't accept as input, so
 *  they're stripped here. */
export type GlobalSeedData<TSlug extends GlobalSlug> = WithRefs<
  Omit<DataFromGlobalSlug<TSlug>, 'id' | 'globalType' | 'createdAt' | 'updatedAt'>
>

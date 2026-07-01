import type { CollectionSlug, DataFromGlobalSlug, GlobalSlug, RequiredDataFromCollectionSlug } from 'payload'
import type { file, FileToken, ref, Ref } from './refs'

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

/** Tokens handed to every seed builder: `ref` (point at another seeded doc) and `file`
 *  (attach a source file to an upload/provider doc via its `_file`). */
export interface SeedTokens {
  ref: typeof ref
  file: typeof file
}

/**
 * Registers a collection whose bytes are ingested by an external service rather than stored as a
 * Payload upload — e.g. `@pro-laico/payload-mux`'s `mux-video` (Mux) or `@pro-laico/payload-fonts`'s
 * `font`. Tells the seed engine that a `_file` on a doc in this collection should be resolved under
 * `subdir` and handed to the collection's own ingest hook via `sourceField`, instead of uploaded as
 * bytes. Plain config: the actual ingest lives in the owning plugin's hook, so the seed engine stays
 * decoupled from that plugin and its SDK.
 */
export interface SeedAssetProvider {
  /** The collection these source files are ingested into (e.g. `'mux-video'`). */
  collection: string
  /** Subdirectory under the assets dir holding the source files. @default 'source' */
  subdir?: string
  /** Doc field the engine sets to `{ file, ...options }` for the ingest hook to consume. @default 'source' */
  sourceField?: string
}

/** A seed builder receives the ref/file tokens and returns the seed data. Deferred
 *  (not eager data) so refs resolve against the full definition set. */
export type SeedBuilder<T> = (tokens: SeedTokens) => T

export interface CollectionSeedDefinition<TSlug extends CollectionSlug = CollectionSlug> {
  readonly kind: 'collection'
  readonly slug: TSlug
  readonly build: SeedBuilder<Array<CollectionSeedData<TSlug>>>
}

export interface GlobalSeedDefinition<TSlug extends GlobalSlug = GlobalSlug> {
  readonly kind: 'global'
  readonly slug: TSlug
  readonly build: SeedBuilder<GlobalSeedData<TSlug>>
}

export type SeedDefinition = CollectionSeedDefinition | GlobalSeedDefinition

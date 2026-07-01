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
 * A collection's `custom.seedAsset` marker: declares a collection whose `_file` bytes are ingested
 * by the collection's own hook rather than stored as a Payload upload — e.g. `@pro-laico/payload-mux`'s
 * `mux-video` (uploaded to Mux). Set on the collection config:
 *
 *   { slug: 'mux-video', custom: { seedAsset: { sourceField: 'source' } }, ... }
 *
 * Instead of uploading bytes, the seed engine resolves the `_file` under `subdir` and sets it as
 * `{ file, ...options }` on the doc's `sourceField`, for the collection's ingest hook to consume.
 * `true` is shorthand for the defaults (`sourceField: 'source'`, `subdir`: the collection slug).
 * Plain config — no import of the seed package needed, so the owning plugin stays decoupled from it.
 */
export type SeedAssetMarker =
  | true
  | {
      /** Doc field the engine sets to `{ file, ...options }` for the ingest hook. @default 'source' */
      sourceField?: string
      /** Subdirectory under the assets dir holding the source files. @default the collection slug */
      subdir?: string
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

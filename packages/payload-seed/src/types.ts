import type { CollectionSlug, DataFromGlobalSlug, GlobalSlug, RequiredDataFromCollectionSlug } from 'payload'
import type { AnyRef, asset, ref } from './refs'

/**
 * Recursively widens a generated Payload data type so a {@link Ref} / {@link AssetRef}
 * token may appear at any object field or array element — that's how relationship and
 * upload values are supplied as tokens instead of ids. The shape (field names,
 * required-ness) is still enforced, so changing a collection's schema still surfaces a
 * TS error in its seed file. Intentionally permissive at the leaf for v1: the runtime
 * validator checks that each token actually lands in a relationship/upload field whose
 * config allows the referenced collection.
 */
export type WithRefs<T> = T extends AnyRef
  ? T
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? Array<WithRefs<U> | AnyRef>
      : T extends object
        ? { [K in keyof T]: WithRefs<T[K]> | AnyRef }
        : T

/** A single collection seed record: the collection's create-data plus a local `_key`
 *  used as its reference handle. */
export type CollectionSeedData<TSlug extends CollectionSlug> = WithRefs<RequiredDataFromCollectionSlug<TSlug>> & { _key: string }

/** A global's seed data (globals are singletons — no `_key`). */
export type GlobalSeedData<TSlug extends GlobalSlug> = WithRefs<DataFromGlobalSlug<TSlug>>

/** Tokens handed to every seed builder. */
export interface SeedTokens {
  ref: typeof ref
  asset: typeof asset
}

/** A seed builder receives the ref/asset tokens and returns the seed data. Deferred
 *  (not eager data) so refs resolve against the full, discovered definition set. */
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

export interface BlockSeedDefinition<T = unknown> {
  readonly kind: 'block'
  readonly blockType: string
  readonly build: SeedBuilder<WithRefs<T> & { blockType: string }>
}

export type SeedDefinition = CollectionSeedDefinition | GlobalSeedDefinition | BlockSeedDefinition

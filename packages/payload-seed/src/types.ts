import type { CollectionSlug, DataFromGlobalSlug, GlobalSlug, RequiredDataFromCollectionSlug } from 'payload'
import type { AnyToken, asset, ref, video } from './refs'

/**
 * Recursively widens a generated Payload data type so a seed token ({@link Ref} /
 * {@link AssetRef} / {@link SourceRef}) may appear at any object field or array element —
 * that's how relationship/upload/source values are supplied as tokens instead of ids. The
 * shape (field names, required-ness) is still enforced, so changing a collection's schema
 * still surfaces a TS error in its seed file. Intentionally permissive at the leaf for v1: the
 * runtime validator checks that each token actually lands in a field whose config allows it.
 */
export type WithRefs<T> = T extends AnyToken
  ? T
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? Array<WithRefs<U> | AnyToken>
      : T extends object
        ? { [K in keyof T]: WithRefs<T[K]> | AnyToken }
        : T

/** A single collection seed record: the collection's create-data plus a local `_key`
 *  used as its reference handle. */
export type CollectionSeedData<TSlug extends CollectionSlug> = WithRefs<RequiredDataFromCollectionSlug<TSlug>> & { _key: string }

/** A global's seed data (globals are singletons — no `_key`). The generated global type
 *  carries `id`/`globalType`/timestamps that `updateGlobal` doesn't accept as input, so
 *  they're stripped here. */
export type GlobalSeedData<TSlug extends GlobalSlug> = WithRefs<
  Omit<DataFromGlobalSlug<TSlug>, 'id' | 'globalType' | 'createdAt' | 'updatedAt'>
>

/** Tokens handed to every seed builder. `video` is available when a Mux asset provider is
 *  registered (`assetProviders`); calling it without one throws a clear runtime error. */
export interface SeedTokens {
  ref: typeof ref
  asset: typeof asset
  video: typeof video
}

/**
 * Registers an external-asset collection with the seed engine so its source files seed like
 * image assets: declared with a builder source token (e.g. `video('clip.mp4')`) and run by the
 * normal seed flow — no script. The collection is cleared via `payload.delete` so its hooks
 * (e.g. external-asset cleanup) fire. Plain config: the actual upload happens in the owning
 * plugin's collection hook, so the seed engine stays decoupled from that plugin and its SDK.
 *
 * `@pro-laico/payload-mux` exports `muxAssetProvider()`, which returns this shape.
 */
export interface SeedAssetProvider {
  /** Builder token name exposed in seed files (e.g. `'video'`). */
  token: string
  /** Collection the source files are ingested into (e.g. `'mux-video'`). */
  collection: string
  /** Subdirectory under the assets dir holding the source files. @default the token name */
  sourceDir?: string
}

/** A seed builder receives the ref/asset tokens and returns the seed data. Deferred
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

/** Declares one source asset: the file to upload (relative to the assets dir) and the
 *  upload-doc data. The engine uploads these FIRST and resolves `asset(key)` to the
 *  created doc's id. `focalX`/`focalY` set the upload's focal point (measured from the
 *  top-left as percentages). */
export interface AssetSpec {
  /** Filename within the assets dir. The loader tolerates an extension mismatch
   *  (a spec naming `foo.png` picks up `foo.jpg` if that's what's on disk). */
  file: string
  /** Upload collection to create the asset in. Defaults to the plugin's `assets.collection`. */
  collection?: CollectionSlug
  alt?: string
  focalX?: number
  focalY?: number
  /** Extra fields to set on the created upload doc. */
  data?: Record<string, unknown>
}

export interface AssetsSeedDefinition {
  readonly kind: 'assets'
  readonly specs: Record<string, AssetSpec>
}

export type SeedDefinition = CollectionSeedDefinition | GlobalSeedDefinition | AssetsSeedDefinition

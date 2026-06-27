import type { CollectionSlug, GlobalSlug } from 'payload'
import { asset, ref } from './refs'
import type {
  AssetSpec,
  AssetsSeedDefinition,
  CollectionSeedData,
  CollectionSeedDefinition,
  GlobalSeedData,
  GlobalSeedDefinition,
  SeedTokens,
} from './types'

const tokens = { ref, asset }

// Re-enable excess-property checking, which TS disables for our mapped/intersection record
// types: any key on `T` not present in `Shape` is forced to `never`, so a misspelled or
// bogus field fails to type-check. (Wrong-*typed* values are already caught by the `extends`
// constraint; this adds the missing unknown-*field* check.)
type Exact<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>
type ExactEach<T extends readonly unknown[], Shape> = { [I in keyof T]: Exact<T[I], Shape> }

/**
 * Define seed data for a collection. The builder returns an array of records typed
 * against the app's generated Payload types (`RequiredDataFromCollectionSlug<slug>`),
 * each with a local `_key` reference handle. Relationship/upload fields accept `ref()` /
 * `asset()` tokens. Unknown fields are rejected. Default-export one per `seed.ts` file, then
 * wire it into `seedPlugin({ definitions })` (e.g. via a `plugins/` barrel).
 *
 *   export default defineSeed('services', ({ asset }) => [
 *     { _key: 'consulting', title: 'Consulting', slug: 'consulting', image: asset('serviceA') },
 *   ])
 */
export function defineSeed<TSlug extends CollectionSlug, const T extends ReadonlyArray<CollectionSeedData<TSlug>>>(
  slug: TSlug,
  build: (tokens: SeedTokens) => ExactEach<T, CollectionSeedData<TSlug>>,
): CollectionSeedDefinition<TSlug> {
  return { kind: 'collection', slug, build } as CollectionSeedDefinition<TSlug>
}

/** Define seed data for a global (a singleton — no `_key`). Unknown fields are rejected. */
export function defineGlobalSeed<TSlug extends GlobalSlug, const T extends GlobalSeedData<TSlug>>(
  slug: TSlug,
  build: (tokens: SeedTokens) => Exact<T, GlobalSeedData<TSlug>>,
): GlobalSeedDefinition<TSlug> {
  return { kind: 'global', slug, build } as GlobalSeedDefinition<TSlug>
}

/**
 * Declare the source assets the seed uploads first. Each key becomes an `asset(key)`
 * reference; its spec points at a file in the assets dir plus the upload-doc data. The
 * engine uploads them before any content so `asset()` tokens resolve to real ids.
 *
 *   export default defineAssets({
 *     serviceA: { file: 'service-1.jpg', alt: 'A service in action' },
 *     logo:     { file: 'logo.png', alt: 'Brand logo' },
 *   })
 */
export function defineAssets(specs: Record<string, AssetSpec>): AssetsSeedDefinition {
  return { kind: 'assets', specs }
}

export { tokens }

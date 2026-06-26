import type { CollectionSlug, GlobalSlug } from 'payload'
import { asset, ref } from './refs'
import type {
  AssetSpec,
  AssetsSeedDefinition,
  BlockSeedDefinition,
  CollectionSeedData,
  CollectionSeedDefinition,
  GlobalSeedData,
  GlobalSeedDefinition,
  SeedBuilder,
  WithRefs,
} from './types'

const tokens = { ref, asset }

/**
 * Define seed data for a collection. The builder returns an array of records typed
 * against the app's generated Payload types (`RequiredDataFromCollectionSlug<slug>`),
 * each with a local `_key` reference handle. Relationship/upload fields accept `ref()` /
 * `asset()` tokens. Place one in a `seed.ts` file colocated with the collection — the
 * plugin auto-discovers it.
 *
 *   export default defineSeed('services', ({ asset }) => [
 *     { _key: 'consulting', title: 'Consulting', slug: 'consulting', image: asset('serviceA') },
 *   ])
 */
export function defineSeed<TSlug extends CollectionSlug>(
  slug: TSlug,
  build: SeedBuilder<Array<CollectionSeedData<TSlug>>>,
): CollectionSeedDefinition<TSlug> {
  return { kind: 'collection', slug, build }
}

/** Define seed data for a global (a singleton — no `_key`). */
export function defineGlobalSeed<TSlug extends GlobalSlug>(
  slug: TSlug,
  build: SeedBuilder<GlobalSeedData<TSlug>>,
): GlobalSeedDefinition<TSlug> {
  return { kind: 'global', slug, build }
}

/**
 * Define a reusable block fragment composed into a page's layout. Its `ref`/`asset`
 * tokens propagate into the host page's dependency set. Pass the block's generated type
 * as `T` for full typing (block typing is refined per Payload version).
 *
 *   export default defineBlockSeed<HeroBlock>('hero', ({ asset }) => ({ blockType: 'hero', image: asset('hero') }))
 */
export function defineBlockSeed<T = unknown>(
  blockType: string,
  build: SeedBuilder<WithRefs<T> & { blockType: string }>,
): BlockSeedDefinition<T> {
  return { kind: 'block', blockType, build }
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

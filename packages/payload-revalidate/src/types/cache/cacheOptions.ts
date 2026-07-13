import type { Payload } from 'payload'

import type { Tags } from './tagOptions'
import type { WalkOptions } from './walk'

interface BaseOptions {
  /** This read is draft-scoped (key `draft` as a getter argument!) — draft-lane tag
   *  variants are added so draft saves purge it. @default false */
  draft?: boolean
  /** Extra static tags for this entry (e.g. `'sitemap'`). */
  tags?: string[]
  /** Name for this read in the dev map (defaults to its shape). */
  label?: string
}

export interface CacheDocOptions extends BaseOptions {
  /** The identifier the read is keyed by — an alias (slug) or id. Tagged even when the
   *  doc is `null`, so a cached miss purges the moment the doc is created. */
  as?: string | number
  /** Tune ({@link WalkOptions}) or disable (`false`) the bake-in walk. */
  walk?: false | WalkOptions
}

export interface CacheIdsOptions extends BaseOptions {
  /** The declared list scope this read renders (`lists.recent` in the plugin options) —
   *  the entry carries `{slug}:list:{scope}` so reorders bust it precisely. Omit for the
   *  bare collection list tag (membership events only). */
  list?: string
}

export interface FinishInput {
  /** The live handle the read ran on — the walk indexes ITS config, never a resolved one. */
  payload: Payload
  /** Prefix-bound builders resolved from the handle's config marker. */
  tags: Tags
  observe: boolean
  kind: 'doc' | 'global'
  collection?: string
  global?: string
  as?: string | number
  staticTags: string[]
  value: unknown
  slug: string
  options: CacheDocOptions
}

/** The read-side surface `createCacheHelpers` binds to the app's one live session. */
export interface CacheHelpers {
  cacheDoc: <T>(doc: T, collection: string, options?: CacheDocOptions) => Promise<T>
  cacheIds: <T>(result: T, collection: string, options?: CacheIdsOptions) => Promise<T>
  cacheGlobal: <T>(doc: T, slug: string, options?: CacheDocOptions) => Promise<T>
  /** Manually bust one doc's tags (both lanes) — for flows outside the auto hooks. */
  revalidateDoc: (slug: string, id: string | number) => Promise<void>
  /** Manually bust a collection's list tags — bare + every declared scope, both lanes. */
  revalidateList: (slug: string) => Promise<void>
  /** Manually bust a global's tags (both lanes). */
  revalidateGlobal: (slug: string) => Promise<void>
  /** Bust every entry the cache helpers tagged — they all carry `all`. */
  revalidateAll: () => Promise<void>
}

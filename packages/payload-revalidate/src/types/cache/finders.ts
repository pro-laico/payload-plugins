import type {
  CollectionSlug,
  FindOptions,
  GlobalSlug,
  PopulateType,
  RequestContext,
  SelectType,
  TransformCollectionWithSelect,
  TransformGlobalWithSelect,
  TypedCollectionSelect,
  TypedFallbackLocale,
  TypedGlobalSelect,
  TypedLocale,
} from 'payload'

import type { CacheDocOptions, CacheIdsOptions } from './cacheOptions'

/** Payload keeps these derivations internal (collections/config/types) — same shape, re-derived from root exports. */
export type SelectFromCollectionSlug<TSlug extends CollectionSlug> = TypedCollectionSelect[TSlug]
export type SelectFromGlobalSlug<TSlug extends GlobalSlug> = TypedGlobalSelect[TSlug]

/** A 'use cache' entry is keyed by arguments and shared across requesters — a user-scoped
 *  read would serve the first requester's view to everyone, so finders never accept these. */
type SharedReadScrub = 'req' | 'user'

export type FindDocOptions<TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>> = CacheDocOptions &
  Omit<FindOptions<TSlug, TSelect>, 'collection' | 'currentDepth' | 'disableErrors' | 'limit' | 'page' | 'pagination' | SharedReadScrub>

export type FindDocByIDOptions<TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>> = Omit<CacheDocOptions, 'as'> &
  Omit<
    FindOptions<TSlug, TSelect>,
    'collection' | 'currentDepth' | 'disableErrors' | 'limit' | 'page' | 'pagination' | 'sort' | 'where' | SharedReadScrub
  >

export type FindIdsOptions<TSlug extends CollectionSlug> = CacheIdsOptions &
  Omit<
    FindOptions<TSlug, Record<string, never>>,
    'collection' | 'currentDepth' | 'depth' | 'disableErrors' | 'joins' | 'populate' | 'select' | 'showHiddenFields' | SharedReadScrub
  >

export interface FindGlobalOptions<TSelect extends SelectType = SelectType> extends Omit<CacheDocOptions, 'as'> {
  context?: RequestContext
  depth?: number
  fallbackLocale?: TypedFallbackLocale
  locale?: 'all' | TypedLocale
  overrideAccess?: boolean
  populate?: PopulateType
  select?: TSelect
  showHiddenFields?: boolean
}

export interface IdsResult {
  ids: (string | number)[]
  page: number
  totalDocs: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface CacheFinders {
  findIds: <TSlug extends CollectionSlug>(collection: TSlug, options?: FindIdsOptions<TSlug>) => Promise<IdsResult>
  findGlobal: <TSlug extends GlobalSlug, TSelect extends SelectFromGlobalSlug<TSlug>>(
    slug: TSlug,
    options?: FindGlobalOptions<TSelect>,
  ) => Promise<TransformGlobalWithSelect<TSlug, TSelect>>
  findDoc: <TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>>(
    collection: TSlug,
    options?: FindDocOptions<TSlug, TSelect>,
  ) => Promise<TransformCollectionWithSelect<TSlug, TSelect> | null>
  findDocByID: <TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>>(
    collection: TSlug,
    id: string | number,
    options?: FindDocByIDOptions<TSlug, TSelect>,
  ) => Promise<TransformCollectionWithSelect<TSlug, TSelect> | null>
}

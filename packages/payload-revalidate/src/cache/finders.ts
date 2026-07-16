import type { CollectionSlug, GlobalSlug, Payload, TransformCollectionWithSelect, TransformGlobalWithSelect } from 'payload'

import { docId } from '../lib/values'
import type {
  CacheFinders,
  CacheHelpers,
  FindDocByIDOptions,
  FindDocOptions,
  FindGlobalOptions,
  FindIdsOptions,
  IdsResult,
  SelectFromCollectionSlug,
  SelectFromGlobalSlug,
} from '../types'

/** Runtime backstop for JS callers — the option types already omit user/req. */
const assertSharedRead = (name: string, options: object): void => {
  if ('user' in options || 'req' in options)
    throw new Error(
      `[payload-revalidate] ${name} does not accept 'user'/'req' — a 'use cache' entry is keyed by arguments and shared across requesters, so a user-scoped read would serve one requester's view to everyone. Run user-scoped reads outside the cache boundary with payload.find directly (and key any cached getter by access scope).`,
    )
}

export const createCacheFinders = (
  handle: Payload | Promise<Payload>,
  base: Pick<CacheHelpers, 'cacheDoc' | 'cacheGlobal' | 'cacheIds'>,
): CacheFinders => {
  async function findDoc<TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>>(
    collection: TSlug,
    options: FindDocOptions<TSlug, TSelect> = {},
  ): Promise<TransformCollectionWithSelect<TSlug, TSelect> | null> {
    assertSharedRead('findDoc', options)
    const payload = await handle
    const { as, depth, draft, label, tags, walk, ...find } = options
    const res = await payload.find({
      ...find,
      collection,
      draft,
      limit: 1,
      pagination: false,
      depth: depth ?? 0,
    })
    return base.cacheDoc(res.docs.at(0) ?? null, collection, { as, draft, label, tags, walk })
  }

  async function findDocByID<TSlug extends CollectionSlug, TSelect extends SelectFromCollectionSlug<TSlug>>(
    collection: TSlug,
    id: string | number,
    options: FindDocByIDOptions<TSlug, TSelect> = {},
  ): Promise<TransformCollectionWithSelect<TSlug, TSelect> | null> {
    assertSharedRead('findDocByID', options)
    const payload = await handle
    const { depth, draft, label, tags, walk, ...find } = options
    const doc = await payload.findByID({
      ...find,
      id,
      draft,
      collection,
      depth: depth ?? 0,
      disableErrors: true,
    })
    return base.cacheDoc(doc, collection, { draft, label, tags, walk })
  }

  async function findIds<TSlug extends CollectionSlug>(collection: TSlug, options: FindIdsOptions<TSlug> = {}): Promise<IdsResult> {
    assertSharedRead('findIds', options)
    const payload = await handle
    const { draft, label, list, tags, ...find } = options
    const res = await payload.find({
      ...find,
      collection,
      draft,
      depth: 0,
      select: {},
    })
    await base.cacheIds(res, collection, { draft, label, list, tags })
    return {
      ids: res.docs.map(docId).filter((id): id is string | number => id !== undefined),
      page: res.page ?? 1,
      totalDocs: res.totalDocs,
      totalPages: res.totalPages,
      hasNextPage: res.hasNextPage,
      hasPrevPage: res.hasPrevPage,
    }
  }

  async function findGlobal<TSlug extends GlobalSlug, TSelect extends SelectFromGlobalSlug<TSlug>>(
    slug: TSlug,
    options: FindGlobalOptions<TSelect> = {},
  ): Promise<TransformGlobalWithSelect<TSlug, TSelect>> {
    assertSharedRead('findGlobal', options)
    const payload = await handle
    const { draft, depth, label, tags, walk, ...find } = options
    const doc = await payload.findGlobal<TSlug, TSelect>({
      ...find,
      slug,
      draft,
      depth: depth ?? 0,
    })
    return base.cacheGlobal(doc, slug, { draft, label, tags, walk })
  }

  return { findDoc, findDocByID, findGlobal, findIds }
}

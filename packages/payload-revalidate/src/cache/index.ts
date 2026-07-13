import 'server-only'

import { getPayloadClient } from '../lib/configStash'
import { recordRead } from '../lib/observe/registry'
import { getState } from '../lib/state'
import { riskyAliasReason, tags } from '../lib/tags'
import { isId } from '../lib/values'
import type { CacheDocOptions, CacheIdsOptions, WalkOptions } from '../types'
import { applyCacheTags, ensureStash, finish, warnOnce, withDraftVariants } from './finish'

/**
 * The read side — atomic by design. Two rules shape every getter:
 *
 * 1. **Fetch shallow, reference by id.** A doc's entry holds ITS content; anything it
 *    references stays an id, rendered by a component that self-fetches through an
 *    id-keyed `cacheDoc` getter. Freshness then lives per doc: editing an image busts
 *    `media:{id}` and ONLY the image's own entry re-materializes — every host entry
 *    (holding just the id) survives, and Next recomposes on the next request.
 * 2. **Lists are id-lists.** `cacheIds` tags membership/order only; each item is its own
 *    `cacheDoc` entry. A title edit re-renders one card, not the archive.
 *
 * Populated content that DOES get baked in (depth > 0) is still tagged for correctness —
 * and reported as a refactor candidate in dev (console + the /dev/revalidate map).
 *
 * @example
 * ```ts
 * import { cacheDoc, cacheIds, getPayloadClient } from '@pro-laico/payload-revalidate/cache'
 *
 * export async function getPostIds(page = 1) {
 *   'use cache'
 *   const payload = await getPayloadClient()
 *   const res = await payload.find({ collection: 'posts', page, limit: 12, sort: '-publishedAt', select: {}, depth: 0 })
 *   return cacheIds(res, 'posts', { list: 'recent' })
 * }
 *
 * export async function getPost(id: string | number) {
 *   'use cache'
 *   const payload = await getPayloadClient()
 *   return cacheDoc(await payload.findByID({ collection: 'posts', id, depth: 0, disableErrors: true }), 'posts')
 * }
 * ```
 */

const docId = (doc: unknown): string | number | undefined =>
  typeof doc === 'object' && doc !== null && isId((doc as { id?: unknown }).id) ? (doc as { id: string | number }).id : undefined

/**
 * Tag a doc-scoped read — THE atomic unit. Tags: `all`, `{slug}:{id}` (when the doc
 * resolved), `{slug}:{as}` (the alias/identifier it was keyed by — also on `null` misses),
 * any baked-in doc's tag (dev-flagged), and `:draft` variants when `draft`. A `null` doc
 * with no `as` falls back to the bare list tag so the miss still purges on the next create.
 */
export async function cacheDoc<T>(doc: T, collection: string, options: CacheDocOptions = {}): Promise<T> {
  await ensureStash()
  const id = docId(doc)
  const staticTags = [tags.all()]
  if (id !== undefined) staticTags.push(tags.doc(collection, id))
  if (options.as !== undefined && options.as !== id) {
    staticTags.push(tags.doc(collection, options.as))
    const risk = riskyAliasReason(options.as)
    if (risk)
      warnOnce(
        `alias:${collection}:${options.as}`,
        `cacheDoc('${collection}', { as: '${options.as}' }) — alias ${risk}. Over-busts only (never stale), but rename the idField value to avoid coincidental cache purges.`,
      )
  }
  if (doc == null && options.as === undefined) staticTags.push(tags.list(collection))
  await finish({ kind: 'doc', collection, as: options.as ?? id, staticTags, value: doc, slug: collection, options })
  return doc
}

/**
 * Tag an id-list read (a Payload result, an array of docs, or a plain id array). Tags:
 * `all` + the collection's list tag (scoped via `list`, bare otherwise) — deliberately NO
 * per-doc tags and no walk: this entry is membership/order only, and each item renders
 * through its own id-keyed `cacheDoc` getter. Content edits never touch it; membership
 * events (and the scope's declared fields) do.
 */
export async function cacheIds<T>(result: T, collection: string, options: CacheIdsOptions = {}): Promise<T> {
  await ensureStash()
  const items: unknown[] = Array.isArray(result) ? result : ((result as { docs?: unknown[] } | null)?.docs ?? [])
  const name = options.label ?? `ids:${collection}${options.list ? `:${options.list}` : ''}`

  // Teach: full docs passed here means content is (presumably) rendered from this entry,
  // but ids-only tagging will NOT refresh it on content edits. Upload plumbing is exempt:
  // Payload returns it even under `select: {}`, so on an upload collection those keys say
  // nothing about what the getter selected.
  const uploadMeta = ['filename', 'filesize', 'mimeType', 'width', 'height', 'focalX', 'focalY', 'url', 'thumbnailURL', 'sizes']
  const contentKeys = items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .flatMap((doc) => Object.keys(doc))
    .filter((key) => !['id', 'createdAt', 'updatedAt', '_status', ...uploadMeta].includes(key))
  if (contentKeys.length)
    warnOnce(
      `content:${name}`,
      `${name} received docs carrying content (${[...new Set(contentKeys)].slice(0, 5).join(', ')}…) — cacheIds tags membership only. Fetch with select: {} and render items through id-keyed cacheDoc getters, or content edits won't refresh this entry.`,
    )

  // Police the scope: hooks bust only DECLARED scopes, so an undeclared one goes stale on
  // reorders. Only when the plugin's stash is present — without it (plugin never ran in
  // this process) declaration status is unknowable and the warning would be spurious.
  const stashedLists = getState().lists
  const declared = stashedLists?.[collection]
  const undeclared = stashedLists !== undefined && options.list !== undefined && !(declared ?? []).includes(options.list)
  if (undeclared)
    warnOnce(
      `scope:${name}`,
      `${name} carries undeclared list scope '${options.list}' — reorders won't bust it. Declare it: revalidatePlugin({ collections: { ${collection}: { lists: { ${options.list}: { fields: ['<sort/filter fields>'] } } } } }).`,
    )

  const statics = withDraftVariants([tags.all(), tags.list(collection, { scope: options.list }), ...(options.tags ?? [])], options.draft)
  recordRead({
    kind: 'ids',
    collection,
    list: options.list,
    ...(undeclared ? { undeclared } : {}),
    draft: options.draft ?? false,
    label: options.label,
    staticTags: statics,
    depTags: [],
    bakedIn: [],
    capped: false,
  })
  await applyCacheTags([...new Set(statics)])
  return result
}

/** Tag a global read. Tags: `all`, `global:{slug}`, baked-in docs (dev-flagged), draft variants. */
export async function cacheGlobal<T>(doc: T, slug: string, options: CacheDocOptions = {}): Promise<T> {
  await ensureStash()
  await finish({ kind: 'global', global: slug, staticTags: [tags.all(), tags.global(slug)], value: doc, slug, options })
  return doc
}

export { revalidateAll, revalidateDoc, revalidateGlobal, revalidateList } from './manual'
export { getPayloadClient }
export { tags }
export type { WalkOptions }

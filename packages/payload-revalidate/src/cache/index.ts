import 'server-only'

import type { Payload } from 'payload'

import { readRevalidateMarker } from '../lib/marker'
import { recordRead } from '../lib/observe/registry'
import { createTags, riskyAliasReason } from '../lib/tags'
import { isId } from '../lib/values'
import type { CacheDocOptions, CacheHelpers, CacheIdsOptions, PayloadRevalidateMarker, Tags, WalkOptions } from '../types'
import { alertOnce, applyCacheTags, finish, warnOnce, withDraftVariants } from './finish'
import { createManualBusters } from './manual'

/**
 * The read side — atomic by design, bound ONCE to the app's live Payload session. Seed the
 * factory in one module with the same handle your getters fetch with (the `getPayload`
 * promise is welcome as-is — only each read awaits it):
 *
 * ```ts
 * // lib/cache.ts — the one seam
 * import config from '@payload-config'
 * import { getPayload } from 'payload'
 * import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
 *
 * export const { cacheDoc, cacheIds, cacheGlobal } = createCacheHelpers(getPayload({ config }))
 * ```
 *
 * Two rules shape every getter:
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
 * import config from '@payload-config'
 * import { getPayload } from 'payload'
 * import { cacheDoc, cacheIds } from '@/lib/cache'
 *
 * export async function getPostIds(page = 1) {
 *   'use cache'
 *   const payload = await getPayload({ config })
 *   const res = await payload.find({ collection: 'posts', page, limit: 12, sort: '-publishedAt', select: {}, depth: 0 })
 *   return cacheIds(res, 'posts', { list: 'recent' })
 * }
 *
 * export async function getPost(id: string | number) {
 *   'use cache'
 *   const payload = await getPayload({ config })
 *   return cacheDoc(await payload.findByID({ collection: 'posts', id, depth: 0, disableErrors: true }), 'posts')
 * }
 * ```
 */

const docId = (doc: unknown): string | number | undefined =>
  typeof doc === 'object' && doc !== null && isId((doc as { id?: unknown }).id) ? (doc as { id: string | number }).id : undefined

interface ReadCtx {
  payload: Payload
  marker: PayloadRevalidateMarker | undefined
  tags: Tags
  observe: boolean
}

/**
 * Build the read-side helpers ({@link CacheHelpers}) bound to the app's one live session.
 * MUST be seeded at module scope (once per app), never per render — the helpers resolve
 * prefix/scopes/observe from the handle's own config marker on every read, so the same
 * session that fetched a doc is the one that tags it. A `Payload` handle must never cross
 * a `'use cache'` boundary as an ARGUMENT (it isn't serializable) — keep it in module
 * closure, exactly like this factory does.
 */
export const createCacheHelpers = (handle: Payload | Promise<Payload>): CacheHelpers => {
  const ctx = async (): Promise<ReadCtx> => {
    const payload = await handle
    const marker = readRevalidateMarker(payload.config)
    if (!marker)
      alertOnce(
        'marker-missing',
        'cache reads are running against a Payload whose config carries no payloadRevalidate marker — tags are UNPREFIXED, declared list scopes are unknown, and no write-side hooks are attached to bust these entries (they are silently unbustable). Add revalidatePlugin() to the plugins array of the config this handle was booted from.',
      )
    return { payload, marker, tags: createTags(marker?.prefix), observe: marker?.observe ?? false }
  }

  /**
   * Tag a doc-scoped read — THE atomic unit. Tags: `all`, `{slug}:{id}` (when the doc
   * resolved), `{slug}:{as}` (the alias/identifier it was keyed by — also on `null` misses),
   * any baked-in doc's tag (dev-flagged), and `:draft` variants when `draft`. A `null` doc
   * with no `as` falls back to the bare list tag so the miss still purges on the next create.
   */
  async function cacheDoc<T>(doc: T, collection: string, options: CacheDocOptions = {}): Promise<T> {
    const { payload, tags, observe } = await ctx()
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
    await finish({ payload, tags, observe, kind: 'doc', collection, as: options.as ?? id, staticTags, value: doc, slug: collection, options })
    return doc
  }

  /**
   * Tag an id-list read (a Payload result, an array of docs, or a plain id array). Tags:
   * `all` + the collection's list tag (scoped via `list`, bare otherwise) — deliberately NO
   * per-doc tags and no walk: this entry is membership/order only, and each item renders
   * through its own id-keyed `cacheDoc` getter. Content edits never touch it; membership
   * events (and the scope's declared fields) do.
   */
  async function cacheIds<T>(result: T, collection: string, options: CacheIdsOptions = {}): Promise<T> {
    const { marker, tags, observe } = await ctx()
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
    // reorders. Only when the marker is present — without it (plugin not applied to this
    // handle's config) declaration status is unknowable and the warning would be spurious.
    const declared = marker?.lists[collection]
    const undeclared = marker !== undefined && options.list !== undefined && !(declared ?? []).includes(options.list)
    if (undeclared)
      warnOnce(
        `scope:${name}`,
        `${name} carries undeclared list scope '${options.list}' — reorders won't bust it. Declare it: revalidatePlugin({ collections: { ${collection}: { lists: { ${options.list}: { fields: ['<sort/filter fields>'] } } } } }).`,
      )

    const statics = withDraftVariants(
      [tags.all(), tags.list(collection, { scope: options.list }), ...(options.tags ?? [])],
      options.draft,
      tags.all(),
    )
    recordRead(observe, {
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
  async function cacheGlobal<T>(doc: T, slug: string, options: CacheDocOptions = {}): Promise<T> {
    const { payload, tags, observe } = await ctx()
    await finish({
      payload,
      tags,
      observe,
      kind: 'global',
      global: slug,
      staticTags: [tags.all(), tags.global(slug)],
      value: doc,
      slug,
      options,
    })
    return doc
  }

  return { cacheDoc, cacheIds, cacheGlobal, ...createManualBusters(handle) }
}

export type { CacheDocOptions, CacheHelpers, CacheIdsOptions, WalkOptions }

import type { Payload } from 'payload'

import { docId } from '../lib/values'
import { isRecord } from '../_kit'
import { createManualBusters } from './manual'
import { createCacheFinders } from './finders'
import { readRevalidateMarker } from '../lib/marker'
import { recordRead } from '../lib/observe/registry'
import { createTags, riskyAliasReason } from '../lib/tags'
import { alertOnce, applyCacheTags, finish, warnOnce, withDraftVariants } from './finish'
import type { CacheDocOptions, CacheHelpers, CacheIdsOptions, PayloadRevalidateMarker, Tags, WalkOptions } from '../types'

import 'server-only'

interface ReadCtx {
  payload: Payload
  marker: PayloadRevalidateMarker | undefined
  tags: Tags
  observe: boolean
}

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

  async function cacheIds<T>(result: T, collection: string, options: CacheIdsOptions = {}): Promise<T> {
    const { marker, tags, observe } = await ctx()
    const items: unknown[] = Array.isArray(result) ? result : isRecord(result) && Array.isArray(result.docs) ? result.docs : []
    const name = options.label ?? `ids:${collection}${options.list ? `:${options.list}` : ''}`

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

    const declared = marker?.lists[collection]
    const undeclared = marker !== undefined && options.list !== undefined && !(declared ?? []).includes(options.list)
    if (undeclared)
      warnOnce(
        `scope:${name}`,
        `${name} carries undeclared list scope '${options.list}' — reorders won't bust it. Declare it: revalidatePlugin({ collections: { ${collection}: { lists: { ${options.list}: ['<sort/filter fields>'] } } } }).`,
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

  return {
    cacheDoc,
    cacheIds,
    cacheGlobal,
    ...createCacheFinders(handle, { cacheDoc, cacheGlobal, cacheIds }),
    ...createManualBusters(handle),
  }
}

export type { CacheDocOptions, CacheHelpers, CacheIdsOptions, WalkOptions }
export type { CacheFinders, FindDocByIDOptions, FindDocOptions, FindGlobalOptions, FindIdsOptions, IdsResult } from '../types'

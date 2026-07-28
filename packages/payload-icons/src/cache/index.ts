import { cacheTag } from 'next/cache'
import type { Payload, Where } from 'payload'

import type { IconSetMap } from '../types'
import { isRecord } from '../_kit'
import { iconSetSlugOf } from '../lib/marker'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'

import 'server-only'

const activeWhere = (payload: Payload, slug: string, draft: boolean): Where => {
  const hasDrafts = Boolean(payload.collections?.[slug]?.config?.versions?.drafts)
  return !draft && hasDrafts ? { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] } : { active: { equals: true } }
}

const readIconSet = async (payload: Payload, draft: boolean): Promise<IconSetMap> => {
  const slug = iconSetSlugOf(payload.config)

  const res = await payload.find({
    collection: slug,
    where: activeWhere(payload, slug, draft),
    limit: 1,
    depth: 1,
    draft,
    pagination: false,
    select: { iconsArray: true },
    populate: { icon: { svgString: true } },
  })
  const set = res.docs[0]
  if (!set) return {}

  const map: IconSetMap = {}
  const rows = Array.isArray(set.iconsArray) ? set.iconsArray : []
  for (const row of rows) {
    if (!isRecord(row)) continue
    const icon = row.icon
    const svg = isRecord(icon) && typeof icon.svgString === 'string' ? icon.svgString : undefined
    const name = row.name
    if (typeof name === 'string' && svg) map[name] = svg
  }
  return map
}

/** The app's handle, held at module scope and reached by key — NOT captured in the cached
 * function's closure.
 *
 * That distinction is the whole reason this file is shaped this way. A `'use cache'` entry is keyed
 * by its arguments *and its closure*, both of which get serialized; a Payload instance is a class,
 * so capturing the handle fails the build outright with "Only plain objects … can be passed".
 * Module-scope bindings aren't part of that key, so the lookup has to happen through one. The key
 * is the icon-set slug, which is stable per config and meaningful on its own.
 *
 * The handle still only ever arrives from the app, through `createIcon(payload)` — nothing here
 * calls `getPayload` or reads a config off a global. */
const handles = new Map<string, Payload | Promise<Payload>>()

/** `cacheTag` runs INSIDE the cached function, which is the only place it does anything. It used to
 * run in the caller, outside any cache scope, wrapped in a `catch {}` — so every icon read
 * materialized untagged: never reused across requests, and impossible to bust when it was. The tag
 * is the one the icon collections already declare via `custom.revalidate.extraTags`, so an install
 * with `@pro-laico/payload-revalidate` invalidates it on any icon or set write. Without that
 * plugin the entry simply lives out its cache lifetime. */

const readCachedIconSet = async (key: string, draft: boolean): Promise<IconSetMap> => {
  'use cache'
  // Lanes follow payload-revalidate's convention: a published write busts the plain tag, a
  // draft-only write busts `:draft`. The draft read claims both, because publishing changes what
  // the draft lane resolves to as well; the published read claims only the plain tag, so editing a
  // draft never disturbs what visitors are served.
  if (draft) cacheTag(ICONS_REVALIDATE_TAG, `${ICONS_REVALIDATE_TAG}:draft`)
  else cacheTag(ICONS_REVALIDATE_TAG)

  const handle = handles.get(key)
  if (!handle) return {}
  return readIconSet(await handle, draft)
}

export const getIconSvg = async (payload: Payload | Promise<Payload>, name: string, draft = false): Promise<string | undefined> => {
  const resolved = await payload
  const key = iconSetSlugOf(resolved.config)
  handles.set(key, resolved)
  return (await readCachedIconSet(key, draft))[name]
}

const warnedMisses = new Set<string>()

export const warnIconMissDev = async (handle: Payload | Promise<Payload>, name: string, draft = false): Promise<void> => {
  if (process.env.NODE_ENV === 'production' || warnedMisses.has(name)) return
  warnedMisses.add(name)
  try {
    const payload = await handle
    const slug = iconSetSlugOf(payload.config)
    const activeSetExists = async (d: boolean): Promise<boolean> => {
      const find = {
        collection: slug,
        where: activeWhere(payload, slug, d),
        limit: 1,
        depth: 0,
        draft: d,
      }
      return (await payload.find(find)).docs.length > 0
    }
    const cause = (await activeSetExists(draft))
      ? `name '${name}' not in the active set — add it to the set's Icons array`
      : (await activeSetExists(true))
        ? 'active set exists only as a draft — publish it'
        : 'no active icon set — activate one'
    console.warn(`[payload-icons] <Icon name="${name}"> did not resolve: ${cause}`)
  } catch {}
}

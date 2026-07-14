import { cache } from 'react'
import type { CollectionSlug, Payload, Where } from 'payload'

import type { IconSetMap } from '../types'
import { iconSetSlugOf } from '../lib/marker'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'

import 'server-only'

const activeWhere = (payload: Payload, slug: string, draft: boolean): Where => {
  //TODO: replace `as` cast with proper typing
  const hasDrafts = Boolean(
    (payload.collections as Record<string, { config?: { versions?: { drafts?: unknown } } }>)?.[slug]?.config?.versions?.drafts,
  )
  return !draft && hasDrafts ? { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] } : { active: { equals: true } }
}

const getActiveIconSet = cache(async (handle: Payload | Promise<Payload>, draft: boolean): Promise<IconSetMap> => {
  const payload = await handle
  const slug = iconSetSlugOf(payload.config)

  const set = (await payload
    .find({
      collection: slug as CollectionSlug, //TODO: replace `as` cast with proper typing
      where: activeWhere(payload, slug, draft),
      limit: 1,
      depth: 1,
      draft,
      pagination: false,
      select: { iconsArray: true },
      populate: { icon: { svgString: true } },
    })
    .then((res) => res.docs[0] || null)) as {
    iconsArray?: { name?: string | null; icon?: { svgString?: string | null } | string | number | null }[]
  } | null //TODO: replace `as` cast with proper typing

  if (!set) return {}
  const map: IconSetMap = {}
  for (const row of set.iconsArray ?? []) {
    const svg = row?.icon && typeof row.icon === 'object' ? row.icon.svgString : undefined
    if (row?.name && svg) map[row.name] = svg
  }
  return map
})

const tagIconRead = async (handle: Payload | Promise<Payload>): Promise<void> => {
  try {
    if (!(await handle).config.custom?.payloadRevalidate) return
    //TODO: replace `as` cast with proper typing
    const { cacheTag } = (await import('next/cache')) as unknown as { cacheTag: (...tags: string[]) => void }
    cacheTag(ICONS_REVALIDATE_TAG)
  } catch {}
}

export const getIconSvg = async (payload: Payload | Promise<Payload>, name: string, draft = false): Promise<string | undefined> => {
  await tagIconRead(payload)
  return (await getActiveIconSet(payload, draft))[name]
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
        collection: slug as CollectionSlug, //TODO: replace `as` cast with proper typing
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

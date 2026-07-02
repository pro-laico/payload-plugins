import 'server-only'

import { cache } from 'react'
import type { CollectionSlug, Payload, Where } from 'payload'

import { getIconSetSlug, getPayloadClient } from '../lib/getPayloadClient'

/** A `name → svgString` map for the active set's icons. */
type IconSetMap = Record<string, string>

/** The lane-correct active-set filter: published-lane reads also require `_status: 'published'`,
 *  but only when the collection actually has drafts (safe if `drafts: false`). */
const activeWhere = (payload: Payload, slug: string, draft: boolean): Where => {
  const hasDrafts = Boolean(
    (payload.collections as Record<string, { config?: { versions?: { drafts?: unknown } } }>)?.[slug]?.config?.versions?.drafts,
  )
  return !draft && hasDrafts ? { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] } : { active: { equals: true } }
}

/**
 * The active icon set's `name → svgString` map, resolved in a SINGLE query and
 * memoized per request via React `cache()`. Finds the set with `active: true`
 * and populates each row's icon `svgString` in one go (depth 1 + a scoped
 * `populate`), so a page with K icons costs one query, not K+1.
 *
 * On the published frontend (`draft: false`) it filters `_status: 'published'`,
 * so it reads the published-lane active set — a set activated only in the draft
 * lane (staged but not published) resolves to nothing, never leaking to prod.
 * In draft mode it reads the draft-lane active set. The `_status` filter is only
 * applied when the collection actually has drafts (safe if `drafts: false`).
 */
const getActiveIconSet = cache(async (draft: boolean): Promise<IconSetMap> => {
  const payload = await getPayloadClient()
  // Read the slug AFTER getPayloadClient(): resolving the config applies the plugin, which stashes it.
  const slug = getIconSetSlug()

  const set = (await payload
    .find({
      collection: slug as CollectionSlug,
      where: activeWhere(payload, slug, draft),
      limit: 1,
      depth: 1,
      draft,
      pagination: false,
      overrideAccess: true,
      select: { iconsArray: true },
      // Scope the populated icon docs to just the svgString we inline.
      populate: { icon: { svgString: true } },
    })
    .then((res) => res.docs[0] || null)) as {
    iconsArray?: { name?: string | null; icon?: { svgString?: string | null } | string | number | null }[]
  } | null

  if (!set) return {}
  const map: IconSetMap = {}
  for (const row of set.iconsArray ?? []) {
    const svg = row?.icon && typeof row.icon === 'object' ? row.icon.svgString : undefined
    if (row?.name && svg) map[row.name] = svg
  }
  return map
})

/** The SVG string for an icon name, resolved through the active set. Returns
 *  `undefined` when the name isn't in the active set. The single seam for
 *  rendering an icon yourself (the `<Icon>` component is this plus `extractSvg*`). */
export const getIconSvg = async (name: string, draft = false): Promise<string | undefined> => (await getActiveIconSet(draft))[name]

/** Names already warned about, so each miss logs once per process. */
const warnedMisses = new Set<string>()

/** Dev-only diagnosis for an unresolved icon name: one `console.warn` per name per process, naming
 *  the cause — no active set / active set only a draft / name not in the set — with the fix. */
export const warnIconMissDev = async (name: string, draft = false): Promise<void> => {
  if (process.env.NODE_ENV === 'production' || warnedMisses.has(name)) return
  warnedMisses.add(name)
  try {
    const payload = await getPayloadClient()
    const slug = getIconSetSlug()
    const activeSetExists = async (d: boolean): Promise<boolean> => {
      const find = {
        collection: slug as CollectionSlug,
        where: activeWhere(payload, slug, d),
        limit: 1,
        depth: 0,
        draft: d,
        overrideAccess: true,
      }
      return (await payload.find(find)).docs.length > 0
    }
    const cause = (await activeSetExists(draft))
      ? `name '${name}' not in the active set — add it to the set's Icons array`
      : (await activeSetExists(true))
        ? 'active set exists only as a draft — publish it'
        : 'no active icon set — activate one'
    console.warn(`[payload-icons] <Icon name="${name}"> did not resolve: ${cause}`)
  } catch {
    // Diagnostics only — never surface failures into render.
  }
}

import 'server-only'

import { cache } from 'react'
import type { CollectionSlug, Where } from 'payload'

import { getPayloadClient } from '../lib/getPayloadClient'

/** A `name → svgString` map for the active set's icons. */
type IconSetMap = Record<string, string>

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
  const hasDrafts = Boolean(
    (payload.collections as Record<string, { config?: { versions?: { drafts?: unknown } } }>)?.iconSet?.config?.versions?.drafts,
  )
  const where: Where =
    !draft && hasDrafts ? { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] } : { active: { equals: true } }

  const set = (await payload
    .find({
      collection: 'iconSet' as CollectionSlug,
      where,
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

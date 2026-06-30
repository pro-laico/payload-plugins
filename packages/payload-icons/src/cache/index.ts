import 'server-only'

import { cache } from 'react'
import type { CollectionSlug } from 'payload'

import { getPayloadClient } from '../lib/getPayloadClient'
import { toTitleCase } from '../lib/titleCase'

/** The active icon set's icons array — name + icon reference id only. The `icon`
 *  ref is a string under Mongo (ObjectId) and a number under SQLite / Postgres-serial. */
export type IconSetReturn = { iconsArray: { name: string; icon: string | number }[] }

/** Usable-reference guard: with `depth: 0` Payload returns the relationship as its id. */
const isIconRef = (item: {
  name: string
  icon?: string | number | { id: string | number } | null
}): item is { name: string; icon: string | number } => {
  if (typeof item.icon === 'string') return item.icon.length > 0
  return typeof item.icon === 'number'
}

/**
 * The active icon set's icons (name + ref), resolved server-side and memoized
 * per request via React `cache()`. Reads with `overrideAccess` so it works
 * regardless of the `iconSet` read gate. Returns an empty array when no set is
 * active.
 */
export const getCachedIconSet = cache(async (draft: boolean): Promise<IconSetReturn> => {
  const payload = await getPayloadClient()
  const doc = (await payload
    .find({
      collection: 'iconSet' as CollectionSlug,
      depth: 0,
      limit: 1,
      draft,
      pagination: false,
      overrideAccess: true,
      select: { iconsArray: true },
      where: { active: { equals: true } },
    })
    .then((res) => res.docs[0] || null)) as {
    iconsArray?: Array<{ name: string; icon?: string | number | { id: string | number } | null }>
  } | null
  const iconsArray = doc?.iconsArray?.filter(isIconRef).map((item) => ({ name: item.name, icon: item.icon })) || []
  return { iconsArray }
})

/** The SVG string for an icon name, resolved through the active icon set.
 *  Returns `undefined` when the name isn't in the set or its icon has no SVG. */
export const getCachedIconByName = cache(
  async (name: string, draft: boolean, iconSet: IconSetReturn | undefined): Promise<string | undefined> => {
    const iconItem = iconSet?.iconsArray?.find((item) => item.name === name)
    if (iconItem?.icon == null) return undefined
    const payload = await getPayloadClient()
    const icon = (await payload
      .find({ collection: 'icon' as CollectionSlug, limit: 1, draft, overrideAccess: true, where: { id: { equals: iconItem.icon } } })
      .then((res) => res.docs[0] || null)) as { svgString?: string | null } | null
    return icon?.svgString || undefined
  },
)

/** The active set as `{ label, value }` options (e.g. for a select field that
 *  lets another collection pick an icon by name). */
export const getCachedIconOptions = cache(
  async (draft: boolean, iconSet: IconSetReturn | undefined): Promise<{ label: string; value: string }[]> => {
    void draft
    return iconSet?.iconsArray?.map((icon) => ({ value: icon.name, label: toTitleCase(icon.name) })) || []
  },
)

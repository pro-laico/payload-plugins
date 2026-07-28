import config from '@payload-config'
import { type CollectionSlug, getPayload } from 'payload'
import type { SeedStatus } from '@pro-laico/sandbox-shell'
import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'

import 'server-only'

// Module scope on purpose: a `'use cache'` entry serializes its arguments AND its closure into the
// cache key, and a Payload instance is a class. A module-scope binding is the one place it can sit.
const db = getPayload({ config })
const { findDocByID, findIds } = createCacheHelpers(db)

const SEEDED_SLUGS: CollectionSlug[] = ['icon', 'iconSet', 'pages']

/** Doc counts for the seed panel. `findIds` tags this entry with each collection's list tag, so a
 * seed run or any write moves the numbers — no separate bookkeeping. */
export const getStatus = async (): Promise<SeedStatus> => {
  'use cache'
  const counts: Record<string, number> = {}
  for (const slug of SEEDED_SLUGS) counts[slug] = (await findIds(slug, { limit: 200 })).ids.length
  return { seeded: Object.values(counts).some((n) => n > 0), counts }
}

/** The gallery: an id list plus a self-fetch per icon, both through the cache helpers. This one
 * entry ends up tagged with the `icon` list AND every icon doc it inlined, so uploading an SVG or
 * renaming one busts it. The `<Icon>` component's own read is tagged `payload-icons` by the plugin
 * and busted by the same revalidatePlugin write hooks — which is why this sandbox installs it. */
export const getIcons = async () => {
  'use cache'
  const { ids } = await findIds('icon', { sort: 'createdAt', limit: 24 })
  const docs = await Promise.all(ids.map((id) => findDocByID('icon', id)))
  return docs.filter((doc): doc is NonNullable<typeof doc> => doc !== null)
}

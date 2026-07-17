import type { Payload } from 'payload'

import { asSlug } from '../_kit'
import { iconRequestSlugOf } from '../lib/marker'

/** The slug is only known at runtime (it follows `collections.iconRequest.slug`), so Payload types
 * the doc as every collection's shape at once. The collection is the plugin's own, and these two
 * fields are ones it declares. */
type IconRequestDoc = { id: string | number; count?: number }

export const recordIconMiss = async (payload: Payload, name: string): Promise<void> => {
  if (!name) return
  const raw = iconRequestSlugOf(payload.config)
  if (!raw) return
  const slug = asSlug(raw)
  if (!payload.collections?.[slug]) return

  const now = new Date().toISOString()
  const existing = await payload.find({ collection: slug, where: { name: { equals: name } }, limit: 1, depth: 0 })
  const doc = existing.docs[0] as IconRequestDoc | undefined

  if (doc) {
    const count = doc.count ?? 0
    await payload.update({
      collection: slug,
      id: doc.id,
      data: { count: count + 1, lastRequestedAt: now },
    })
  } else {
    await payload.create({
      collection: slug,
      data: { name, count: 1, firstRequestedAt: now, lastRequestedAt: now },
    })
  }
}

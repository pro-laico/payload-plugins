import type { Payload } from 'payload'

import { ICON_REQUEST_SLUG } from '../collections/IconRequest'

export const recordIconMiss = async (payload: Payload, name: string): Promise<void> => {
  if (!name) return
  if (!payload.collections?.[ICON_REQUEST_SLUG]) return

  const now = new Date().toISOString()
  const existing = await payload.find({ collection: ICON_REQUEST_SLUG, where: { name: { equals: name } }, limit: 1, depth: 0 })
  const doc = existing.docs[0]

  if (doc) {
    const count = typeof doc.count === 'number' ? doc.count : 0
    await payload.update({
      collection: ICON_REQUEST_SLUG,
      id: doc.id,
      data: { count: count + 1, lastRequestedAt: now },
    })
  } else {
    await payload.create({
      collection: ICON_REQUEST_SLUG,
      data: { name, count: 1, firstRequestedAt: now, lastRequestedAt: now },
    })
  }
}

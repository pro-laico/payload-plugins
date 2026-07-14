import type { CollectionSlug, Payload } from 'payload'

import { ICON_REQUEST_SLUG } from '../collections/IconRequest'

export const recordIconMiss = async (payload: Payload, name: string): Promise<void> => {
  if (!name) return
  const slug = ICON_REQUEST_SLUG as CollectionSlug //TODO: replace `as` cast with proper typing
  if (!(payload.collections as Record<string, unknown>)?.[ICON_REQUEST_SLUG]) return //TODO: replace `as` cast with proper typing

  const now = new Date().toISOString()
  const existing = await payload.find({ collection: slug, where: { name: { equals: name } }, limit: 1, depth: 0 })
  const doc = existing.docs[0] as { id: string | number; count?: number | null } | undefined //TODO: replace `as` cast with proper typing

  if (doc) {
    await payload.update({
      collection: slug,
      id: doc.id,
      data: { count: (doc.count ?? 0) + 1, lastRequestedAt: now },
    } as Parameters<typeof payload.update>[0]) //TODO: replace `as` cast with proper typing
  } else {
    await payload.create({
      collection: slug,
      data: { name, count: 1, firstRequestedAt: now, lastRequestedAt: now },
    } as Parameters<typeof payload.create>[0]) //TODO: replace `as` cast with proper typing
  }
}

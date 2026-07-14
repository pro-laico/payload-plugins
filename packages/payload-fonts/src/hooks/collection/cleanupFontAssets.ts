import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'

import { isNotFound } from '../../lib/isNotFound'
import { originalIdsFromDoc } from '../../lib/fontDoc'

export const cleanupFontAssetsHook = (opts: { originalSlug?: string; optimizedSlug?: string } = {}): CollectionBeforeDeleteHook => {
  const originalSlug = (opts.originalSlug || 'fontOriginal') as CollectionSlug //TODO: replace `as` cast with proper typing
  const optimizedSlug = (opts.optimizedSlug || 'fontOptimized') as CollectionSlug //TODO: replace `as` cast with proper typing

  return async ({ collection, id, req }) => {
    let data: Record<string, unknown> | undefined
    try {
      data = (await req.payload.findByID({
        collection: collection.slug as CollectionSlug, //TODO: replace `as` cast with proper typing
        id,
        depth: 0,
        req,
      })) as unknown as Record<string, unknown> //TODO: replace `as` cast with proper typing
    } catch {}

    try {
      const optimized = await req.payload.find({
        collection: optimizedSlug,
        where: { font: { equals: id } },
        depth: 0,
        limit: 1000,
        req,
      })
      for (const d of optimized.docs as Array<{ id: string | number }>) {
        //TODO: replace `as` cast with proper typing
        await req.payload.delete({ collection: optimizedSlug, id: d.id, req })
      }
    } catch (err) {
      req.payload.logger.warn({ msg: 'Could not delete optimized fonts', err })
    }

    if (data) {
      for (const oid of originalIdsFromDoc(data)) {
        try {
          await req.payload.delete({ collection: originalSlug, id: oid, req })
        } catch (err) {
          if (!isNotFound(err)) req.payload.logger.warn({ msg: 'Could not delete font original', err })
        }
      }
    }
  }
}

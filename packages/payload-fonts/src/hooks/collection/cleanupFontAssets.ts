import type { CollectionBeforeDeleteHook } from 'payload'

import { isNotFound } from '../../lib/isNotFound'
import { originalIdsFromDoc } from '../../lib/fontDoc'
import { isRecord } from '../../_kit'

export const cleanupFontAssetsHook = ({
  originalSlug,
  optimizedSlug,
}: {
  originalSlug: string
  optimizedSlug: string
}): CollectionBeforeDeleteHook => {
  return async ({ collection, id, req }) => {
    let data: Record<string, unknown> | undefined
    try {
      const raw = await req.payload.findByID({ collection: collection.slug, id, depth: 0, req })
      data = isRecord(raw) ? raw : {}
    } catch {}

    try {
      const optimized = await req.payload.find({
        collection: optimizedSlug,
        where: { font: { equals: id } },
        depth: 0,
        limit: 1000,
        req,
      })
      for (const d of optimized.docs) {
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

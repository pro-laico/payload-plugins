import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'

import { originalIdsFromDoc } from '../../lib/fontDoc'
import { isNotFound } from '../../lib/isNotFound'

/**
 * `beforeDelete` for the `Font` typeface: cascade-delete its served `fontOptimized` files and
 * the `fontOriginal` files its slots referenced, so nothing orphans in storage. Best-effort.
 *
 * It runs `beforeDelete` (not after) on purpose: deleting the `font` doc triggers Payload's
 * dangling-reference cleanup, which nulls `fontOptimized.font` — so by `afterDelete` the served
 * files can no longer be found by their owning typeface. Here the relationship is still intact,
 * so we resolve them by `font` first (and read the originals off the doc's own upload slots).
 */
export const cleanupFontAssetsHook = (opts: { originalSlug?: string; optimizedSlug?: string } = {}): CollectionBeforeDeleteHook => {
  const originalSlug = (opts.originalSlug || 'fontOriginal') as CollectionSlug
  const optimizedSlug = (opts.optimizedSlug || 'fontOptimized') as CollectionSlug

  return async ({ collection, id, req }) => {
    // Load the doc so we can read its `fontOriginal` slot ids (the font's own upload fields).
    let data: Record<string, unknown> | undefined
    try {
      data = (await req.payload.findByID({
        collection: collection.slug as CollectionSlug,
        id,
        depth: 0,
        req,
      })) as unknown as Record<string, unknown>
    } catch {
      // gone already / not found — fall through, optimized cleanup below still runs by `font`
    }

    // Delete the served files, found by owning typeface while the relationship still exists.
    try {
      const optimized = await req.payload.find({
        collection: optimizedSlug,
        where: { font: { equals: id } },
        depth: 0,
        limit: 1000,
        req,
      })
      for (const d of optimized.docs as Array<{ id: string | number }>) {
        await req.payload.delete({ collection: optimizedSlug, id: d.id, req })
      }
    } catch (err) {
      req.payload.logger.warn({ msg: 'Could not delete optimized fonts', err })
    }

    // Delete the originals this typeface referenced (create-only slots → never shared).
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

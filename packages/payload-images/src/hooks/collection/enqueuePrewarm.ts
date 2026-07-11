/**
 * afterChange on the source → enqueue a prewarm job whenever the variant set was invalidated or
 * doesn't exist yet: create, file replace, focal/hotspot edit — the exact trigger set the purge
 * hook uses ({@link detectVariantIdentityChange}), plus the create branch the purge hook skips.
 * Best-effort: a broken jobs setup never blocks or fails the source write.
 */
import type { CollectionAfterChangeHook } from 'payload'

import { IMAGE_MIME_TYPES } from '../../lib/transform/params'
import { enqueuePrewarmJob } from '../../lib/prewarm/enqueue'
import { detectVariantIdentityChange } from './variantIdentity'
import type { PrewarmReason } from '../../types'

export interface EnqueuePrewarmOptions {
  taskSlug: string
  queue: string
}

export const enqueuePrewarmAfterChange = (opts: EnqueuePrewarmOptions): CollectionAfterChangeHook => {
  return async ({ doc, previousDoc, operation, req }) => {
    try {
      if (doc?.id == null || doc?.filename == null) return doc
      if (typeof doc.mimeType === 'string' && !IMAGE_MIME_TYPES.includes(doc.mimeType)) return doc

      let reason: PrewarmReason | undefined
      if (operation === 'create') {
        reason = 'create'
      } else if (operation === 'update') {
        const change = detectVariantIdentityChange(previousDoc, doc)
        if (change.any) reason = change.fileChanged ? 'replace' : 'focal'
      }
      if (reason) await enqueuePrewarmJob(req.payload, { sourceId: doc.id, reason, taskSlug: opts.taskSlug, queue: opts.queue })
    } catch (err) {
      req.payload.logger.warn(`[payload-images] prewarm: enqueue hook failed for ${doc?.id}: ${String(err)}`)
    }
    return doc
  }
}

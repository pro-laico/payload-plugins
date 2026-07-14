import type { CollectionAfterChangeHook } from 'payload'

import type { PrewarmReason } from '../../types'
import { IMAGE_MIME_TYPES } from '../../lib/transform/params'
import { enqueuePrewarmJob } from '../../lib/prewarm/enqueue'
import { detectVariantIdentityChange } from './variantIdentity'

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

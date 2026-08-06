import type { CollectionAfterChangeHook } from 'payload'

import type { PrewarmReason } from '../../types'
import { IMAGE_MIME_TYPES } from '../../lib/transform/params'
import { enqueuePrewarmJob } from '../../lib/prewarm/enqueue'
import { detectVariantIdentityChange } from './variantIdentity'
import { kickPrewarmRunner, UPLOAD_KICK_DELAY_MS } from '../../lib/prewarm/kick'

export interface EnqueuePrewarmOptions {
  taskSlug: string
  queue: string
  /** When set, every enqueue also kicks the queue runner after the response (capped at this many
   * jobs) — the run path on serverless, where the in-process cron never fires. */
  kickLimit?: number
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
      if (reason) {
        await enqueuePrewarmJob(req.payload, { sourceId: doc.id, reason, taskSlug: opts.taskSlug, queue: opts.queue })
        // The kick sleeps out the coalesce window, so rapid saves merge into one job and the last
        // save's kick is the one that finds it due.
        if (opts.kickLimit != null) kickPrewarmRunner(req.payload, { queue: opts.queue, limit: opts.kickLimit, delayMs: UPLOAD_KICK_DELAY_MS })
      }
    } catch (err) {
      req.payload.logger.warn(`[payload-images] prewarm: enqueue hook failed for ${doc?.id}: ${String(err)}`)
    }
    return doc
  }
}

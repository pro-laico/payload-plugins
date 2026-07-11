/**
 * Best-effort prewarm enqueue. The 30s `waitUntil` is the "when possible, not immediately"
 * deferral: it coalesces rapid saves against the pending-job dedupe check and guarantees the
 * purge hook's variant deletes land before generation starts. Never throws — a broken jobs
 * setup must not block a source write.
 */
import type { Payload } from 'payload'

import type { PrewarmReason } from '../../types'

const ENQUEUE_DELAY_MS = 30_000

export interface EnqueuePrewarmArgs {
  sourceId: string | number
  reason: PrewarmReason
  taskSlug: string
  queue: string
  /** Default: now + 30s. Pass false for immediate eligibility (manual sweeps). */
  waitUntil?: Date | false
}

export const enqueuePrewarmJob = async (payload: Payload, args: EnqueuePrewarmArgs): Promise<void> => {
  const sourceId = String(args.sourceId)
  try {
    // Skip when an un-started job for this source is already pending. Nested-JSON `where` on
    // `input` is not portable across DB adapters, so filter the candidate rows in JS. Best-effort:
    // a failed check enqueues anyway — the job itself is idempotent, duplicates are cheap no-ops.
    try {
      const pending = await payload.find({
        collection: 'payload-jobs',
        where: { and: [{ taskSlug: { equals: args.taskSlug } }, { completedAt: { exists: false } }, { processing: { not_equals: true } }] },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      const dupe = pending.docs.some((doc) => {
        const input = (doc as { input?: unknown }).input //EXCUSE: payload-jobs input is untyped JSON; shape-guarded below
        return typeof input === 'object' && input !== null && 'sourceId' in input && String(input.sourceId) === sourceId
      })
      if (dupe) return
    } catch {
      // fall through to enqueue
    }

    await payload.jobs.queue({
      task: args.taskSlug,
      input: { sourceId, reason: args.reason },
      queue: args.queue,
      ...(args.waitUntil === false ? {} : { waitUntil: args.waitUntil ?? new Date(Date.now() + ENQUEUE_DELAY_MS) }),
    } as never) //EXCUSE: TypedJobs is app-generated; the plugin can't name its own task slug in that union (which degenerates entirely in apps with no generated tasks)
  } catch (err) {
    payload.logger.warn(`[payload-images] prewarm: failed to enqueue job for source ${sourceId}: ${String(err)}`)
  }
}

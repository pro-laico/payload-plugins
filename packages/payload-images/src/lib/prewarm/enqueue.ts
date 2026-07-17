import type { Payload } from 'payload'

import { isRecord } from '../../_kit'
import type { PrewarmReason } from '../../types'

const ENQUEUE_DELAY_MS = 30_000

export interface EnqueuePrewarmArgs {
  sourceId: string | number
  reason: PrewarmReason
  taskSlug: string
  queue: string
  waitUntil?: Date | false
}

export const enqueuePrewarmJob = async (payload: Payload, args: EnqueuePrewarmArgs): Promise<void> => {
  const sourceId = String(args.sourceId)
  const waitUntil = args.waitUntil === false ? new Date() : (args.waitUntil ?? new Date(Date.now() + ENQUEUE_DELAY_MS))
  try {
    try {
      const pending = await payload.find({
        collection: 'payload-jobs',
        where: {
          and: [
            { taskSlug: { equals: args.taskSlug } },
            { completedAt: { exists: false } },
            { hasError: { not_equals: true } },
            { processing: { not_equals: true } },
          ],
        },
        limit: 100,
        depth: 0,
      })
      const dupe = pending.docs.find((doc) => {
        const input = isRecord(doc) ? doc.input : undefined
        return isRecord(input) && 'sourceId' in input && String(input.sourceId) === sourceId
      })
      if (dupe && isRecord(dupe) && (typeof dupe.id === 'string' || typeof dupe.id === 'number')) {
        // Re-defer the coalesced job past THIS save's commit — if the runner picked it while our
        // transaction was still open it read pre-commit state and warmed nothing for the new
        // identity. Pushing waitUntil keeps the one-job invariant without going stale.
        await payload.update({ collection: 'payload-jobs', id: dupe.id, data: { waitUntil: waitUntil.toISOString() }, depth: 0 })
        return
      }
    } catch {}

    await payload.jobs.queue({
      task: args.taskSlug,
      input: { sourceId, reason: args.reason },
      queue: args.queue,
      ...(args.waitUntil === false ? {} : { waitUntil }),
    })
  } catch (err) {
    payload.logger.warn(`[payload-images] prewarm: failed to enqueue job for source ${sourceId}: ${String(err)}`)
  }
}

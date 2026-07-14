import type { Payload } from 'payload'

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
      const dupe = pending.docs.some((doc) => {
        const input = (doc as { input?: unknown }).input //TODO: replace `as` cast with proper typing
        return typeof input === 'object' && input !== null && 'sourceId' in input && String(input.sourceId) === sourceId
      })
      if (dupe) return
    } catch {}

    await payload.jobs.queue({
      task: args.taskSlug,
      input: { sourceId, reason: args.reason },
      queue: args.queue,
      ...(args.waitUntil === false ? {} : { waitUntil: args.waitUntil ?? new Date(Date.now() + ENQUEUE_DELAY_MS) }),
    } as never) //TODO: replace `as` cast with proper typing
  } catch (err) {
    payload.logger.warn(`[payload-images] prewarm: failed to enqueue job for source ${sourceId}: ${String(err)}`)
  }
}

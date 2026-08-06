import { after } from 'next/server'
import type { Payload } from 'payload'

import { isRecord } from '../../_kit'
import { ENQUEUE_DELAY_MS } from './enqueue'

/** Just past the enqueue coalesce delay, so the job the current save enqueued is due when the kick fires. */
export const UPLOAD_KICK_DELAY_MS = ENQUEUE_DELAY_MS + 1_000

/** Stop pulling new jobs this long after the kick was scheduled (the coalesce sleep counts): just
 * under the tightest realistic function ceiling — Vercel Hobby's 300s fluid default — so a heavy
 * batch ends cleanly between jobs instead of being killed mid-encode. Whatever's left stays queued
 * for the next kick, drain, or cron. */
export const KICK_TIME_BUDGET_MS = 290_000

/** A `processing: true` job whose runner died (function hit maxDuration, instance recycled) would
 * otherwise look "running" forever and never retry. The claim bumps `updatedAt` and nothing does
 * afterward, so any processing job untouched this long is declared dead and made runnable again.
 * Comfortably past Vercel's 800s ceiling for a legitimate run; the task is idempotent, so a rare
 * false positive only costs duplicate work. */
export const STALE_PROCESSING_MS = 15 * 60_000

export interface KickPrewarmArgs {
  queue: string
  /** Max jobs (one image each) this kick executes. Omit for unbounded — the time budget still caps the run. */
  limit?: number
  /** Sleep before running — an upload kick waits out the coalesce window so rapid saves merge first. */
  delayMs?: number
}

// Best-effort: a failed sweep just leaves the zombie for the next kick.
const sweepStaleJobs = async (payload: Payload, queue: string): Promise<void> => {
  try {
    await payload.update({
      collection: 'payload-jobs',
      where: {
        and: [
          { queue: { equals: queue } },
          { processing: { equals: true } },
          { completedAt: { exists: false } },
          { updatedAt: { less_than: new Date(Date.now() - STALE_PROCESSING_MS).toISOString() } },
        ],
      },
      data: { processing: false },
      depth: 0,
    })
  } catch {}
}

/** Run a slice of the prewarm queue after the current response. This is the serverless-safe runner:
 * `after()` keeps the function alive past the response (Vercel included), where the in-process
 * `autoRun` cron never fires; outside a Next request scope it falls back to a detached run.
 * Best-effort by design — anything a kick misses stays queued for the next kick, drain, or cron. */
export const kickPrewarmRunner = (payload: Payload, args: KickPrewarmArgs): void => {
  const deadline = Date.now() + KICK_TIME_BUDGET_MS
  const work = async (): Promise<void> => {
    if (args.delayMs) await new Promise((resolve) => setTimeout(resolve, args.delayMs))
    await sweepStaleJobs(payload, args.queue)
    // One job per pull so the budget is checked between jobs — payload.jobs.run has no time cap of
    // its own, and a single job is the smallest unit we can stop at.
    for (let remaining = args.limit ?? Number.POSITIVE_INFINITY; remaining > 0 && Date.now() < deadline; remaining--) {
      const res: unknown = await payload.jobs.run({ queue: args.queue, limit: 1 })
      const ranAny = isRecord(res) && isRecord(res.jobStatus) && Object.keys(res.jobStatus).length > 0
      if (!ranAny) break
    }
  }
  const run = (): Promise<void> => work().catch(() => {})
  try {
    after(run)
  } catch {
    void run()
  }
}

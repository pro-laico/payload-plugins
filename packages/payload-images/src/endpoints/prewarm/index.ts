import { after } from 'next/server'
import type { Endpoint, PayloadRequest } from 'payload'

import { isRecord } from '../../_kit'
import { guardSourceRequest } from '../guardSource'
import { enqueuePrewarmJob } from '../../lib/prewarm/enqueue'
import { loadPrewarmPlan, type PrewarmSourceDeps } from '../../lib/prewarm/prewarmSource'
import type { PrewarmLastRun, PrewarmPendingJob, PrewarmPlanItem, PrewarmStatusResponse } from '../../types'

export interface PrewarmEndpointConfig {
  deps: PrewarmSourceDeps
  taskSlug: string
  queue: string
}

// The plugin can't name the app-generated payload-jobs type; narrow the fields it reads.
type JobRow = { id: string | number; input?: unknown; processing?: unknown; waitUntil?: unknown; completedAt?: unknown; log?: unknown }
const isJobRow = (v: unknown): v is JobRow => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')
const matchesSource = (job: JobRow, sourceId: string): boolean =>
  isRecord(job.input) && 'sourceId' in job.input && String(job.input.sourceId) === sourceId

// Run counters live in the job's log array (one entry per attempt), not on the doc itself.
const lastRunFromJob = (job: JobRow): PrewarmLastRun | null => {
  if (typeof job.completedAt !== 'string') return null
  const entries = Array.isArray(job.log) ? job.log.filter(isRecord) : []
  const done = entries.filter((e) => e.state === 'succeeded').at(-1) ?? entries.at(-1)
  const output = done && isRecord(done.output) ? done.output : {}
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
  return {
    completedAt: job.completedAt,
    targets: num(output.targets),
    generated: num(output.generated),
    failed: num(output.failed),
    ...(typeof output.skipped === 'string' ? { skipped: output.skipped } : {}),
  }
}

export const createPrewarmStatusEndpoint = (cfg: PrewarmEndpointConfig): Endpoint => ({
  path: '/img/prewarm/:id',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const guarded = await guardSourceRequest(req, cfg.deps.sourceSlug)
    if (guarded instanceof Response) return guarded
    const { id } = guarded

    try {
      // Polled every few seconds while a job runs — the three reads are independent, so overlap them,
      // and select only the job fields read here (log arrays grow with every attempt).
      const [plan, pending, completed] = await Promise.all([
        loadPrewarmPlan(req.payload, id, cfg.deps),
        // Same query the enqueue dedupe runs, minus the processing exclusion — a running job is state
        // we want. `input` is JSON, so the per-source match happens in-process.
        req.payload.find({
          collection: 'payload-jobs',
          where: { and: [{ taskSlug: { equals: cfg.taskSlug } }, { completedAt: { exists: false } }, { hasError: { not_equals: true } }] },
          select: { input: true, processing: true, waitUntil: true },
          limit: 100,
          depth: 0,
        }),
        req.payload.find({
          collection: 'payload-jobs',
          where: { and: [{ taskSlug: { equals: cfg.taskSlug } }, { completedAt: { exists: true } }] },
          select: { input: true, completedAt: true, log: true },
          sort: '-completedAt',
          limit: 50,
          depth: 0,
        }),
      ])

      const planItems: PrewarmPlanItem[] = plan.ok
        ? plan.targets.map((t): PrewarmPlanItem => ({ params: t.params, format: t.format, cacheKey: t.key }))
        : []

      const active = pending.docs.filter(isJobRow).find((j) => matchesSource(j, id))
      const job: PrewarmPendingJob | undefined = active
        ? {
            id: active.id,
            processing: active.processing === true,
            ...(typeof active.waitUntil === 'string' ? { waitUntil: active.waitUntil } : {}),
          }
        : undefined

      const lastDone = completed.docs.filter(isJobRow).find((j) => matchesSource(j, id))
      const lastRun = lastDone ? lastRunFromJob(lastDone) : null

      const body: PrewarmStatusResponse = {
        status: job ? (job.processing ? 'running' : 'queued') : 'idle',
        plan: planItems,
        ...(plan.ok ? {} : { skipped: plan.skipped }),
        ...(job ? { job } : {}),
        ...(lastRun ? { lastRun } : {}),
      }
      return Response.json(body)
    } catch (err) {
      req.payload.logger.error(`[payload-images] prewarm status failed for ${id}: ${String(err)}`)
      return Response.json({ error: 'Prewarm status failed' }, { status: 500 })
    }
  },
})

export const createPrewarmTriggerEndpoint = (cfg: PrewarmEndpointConfig): Endpoint => ({
  path: '/img/prewarm/:id',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const guarded = await guardSourceRequest(req, cfg.deps.sourceSlug)
    if (guarded instanceof Response) return guarded
    const { id } = guarded

    // Enqueue is deduped + immediate (no 30s deferral for manual runs); generation is sharp-heavy,
    // so the queue runner is kicked after the response instead of inline.
    await enqueuePrewarmJob(req.payload, { sourceId: id, reason: 'manual', taskSlug: cfg.taskSlug, queue: cfg.queue, waitUntil: false })
    const kick = (): Promise<unknown> => req.payload.jobs.run({ queue: cfg.queue })
    try {
      after(() => void kick().catch(() => {}))
    } catch {
      void kick().catch(() => {})
    }
    return Response.json({ queued: true }, { status: 202 })
  },
})

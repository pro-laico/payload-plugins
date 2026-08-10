import type { Payload } from 'payload'

import { PREWARM_TASK_SLUG } from '../lib/prewarm/resolveOptions'
import { prewarmSource, type PrewarmSourceDeps } from '../lib/prewarm/prewarmSource'

export { PREWARM_TASK_SLUG }

/** Bump the job doc at most this often while the run is alive — the stale-processing sweep treats
 * an `updatedAt` older than STALE_PROCESSING_MS as a dead runner, so the beat must land well inside
 * that window. */
const HEARTBEAT_MS = 20_000

// `data: { processing: true }` is a no-op write whose only effect is the `updatedAt` bump.
const makeHeartbeat = (payload: Payload, jobId: string | number | undefined): (() => Promise<void>) => {
  let last = Date.now()
  return async () => {
    if (jobId == null || Date.now() - last < HEARTBEAT_MS) return
    last = Date.now()
    try {
      await payload.update({ collection: 'payload-jobs', id: jobId, data: { processing: true }, depth: 0 })
    } catch {}
  }
}

export interface PrewarmTaskConfig {
  slug: string
  label: string
  interfaceName: string
  inputSchema: { name: string; type: string; required?: boolean; options?: string[] }[]
  outputSchema: { name: string; type: string }[]
  retries: { attempts: number; backoff: { type: 'exponential' | 'fixed'; delay: number } }
  handler: (args: {
    input: { sourceId: string; reason: string }
    job?: { id: string | number }
    req: { payload: Payload }
  }) => Promise<{ output: { targets: number; generated: number; failed: number; skipped?: string } }>
}

export const createPrewarmTask = (deps: PrewarmSourceDeps): PrewarmTaskConfig => ({
  slug: PREWARM_TASK_SLUG,
  label: 'Prewarm image variants',
  interfaceName: 'TaskImagesPrewarm',
  inputSchema: [
    { name: 'sourceId', type: 'text', required: true },
    { name: 'reason', type: 'select', required: true, options: ['create', 'replace', 'focal', 'manual'] },
  ],
  outputSchema: [
    { name: 'targets', type: 'number' },
    { name: 'generated', type: 'number' },
    { name: 'failed', type: 'number' },
    { name: 'skipped', type: 'text' },
  ],
  retries: { attempts: 2, backoff: { type: 'exponential', delay: 30_000 } },
  handler: async ({ input, job, req }) => {
    const res = await prewarmSource(req.payload, input.sourceId, deps, makeHeartbeat(req.payload, job?.id))
    if (res.targets > 0 && res.generated === 0 && res.failed > 0)
      throw new Error(`[payload-images] prewarm: all ${res.failed} variant(s) failed for source ${input.sourceId}`)
    return { output: res }
  },
})

/**
 * The `imagesPrewarm` Payload Jobs task — one job per source. Idempotent by construction: every
 * run recomputes the target list and subtracts already-generated cacheKeys, so retries and
 * duplicate jobs only redo what's missing. Partial failure returns success with counters
 * (retrying wouldn't fix a broken source); total failure throws so the retry policy applies.
 */
import type { Payload } from 'payload'

import { PREWARM_TASK_SLUG } from '../lib/prewarm/resolveOptions'
import { prewarmSource, type PrewarmSourceDeps } from '../lib/prewarm/prewarmSource'

export { PREWARM_TASK_SLUG }

/** Structurally matches payload's TaskConfig (the plugin can't name its own slug in the app-generated TypedJobs union). */
export interface PrewarmTaskConfig {
  slug: string
  label: string
  interfaceName: string
  inputSchema: { name: string; type: string; required?: boolean; options?: string[] }[]
  outputSchema: { name: string; type: string }[]
  retries: { attempts: number; backoff: { type: 'exponential' | 'fixed'; delay: number } }
  handler: (args: {
    input: { sourceId: string; reason: string }
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
  handler: async ({ input, req }) => {
    const res = await prewarmSource(req.payload, input.sourceId, deps)
    if (res.targets > 0 && res.generated === 0 && res.failed > 0)
      throw new Error(`[payload-images] prewarm: all ${res.failed} variant(s) failed for source ${input.sourceId}`)
    return { output: res }
  },
})

import type { OutputFormat } from '../transform/format'
import type { ParsedParams } from '../transform/transformParams'

export type PrewarmJobStatus = 'idle' | 'queued' | 'running'

export interface PrewarmPlanItem {
  /** Aspect ratio is already folded into w/h at parse time, so params fully describe the render. */
  params: ParsedParams
  format: OutputFormat
  cacheKey: string
}

export interface PrewarmPendingJob {
  id: string | number
  processing: boolean
  /** ISO timestamp — present only on hook-enqueued jobs (30s purge-before-warm deferral); manual runs have none. */
  waitUntil?: string
}

export interface PrewarmLastRun {
  completedAt: string
  targets?: number
  generated?: number
  failed?: number
  skipped?: string
}

/**
 * `GET /img/prewarm/:id` response. `lastRun` scans a bounded window of recent completed jobs
 * (input is a JSON field, so matching is in-process) — on a busy queue the last run for this
 * source can age out of the window and read as absent.
 */
export interface PrewarmStatusResponse {
  status: PrewarmJobStatus
  /** Variants the next prewarm run would generate (already-cached ones excluded). */
  plan: PrewarmPlanItem[]
  /** Source can't be prewarmed (deleted file / non-raster) — plan is always [] alongside this. */
  skipped?: 'missing' | 'non-raster'
  /** Present iff status !== 'idle'. */
  job?: PrewarmPendingJob
  lastRun?: PrewarmLastRun
}

/** The prewarm job's contract: why it was queued and what one run did. */

/** Why a prewarm job was enqueued. */
export type PrewarmReason = 'create' | 'replace' | 'focal' | 'manual'

/** One prewarm run's outcome for a single source. */
export interface PrewarmSourceResult {
  /** Variants the compute step selected (after dedup against existing ones). */
  targets: number
  /** Variants successfully generated + persisted this run. */
  generated: number
  failed: number
  /** Set when the source was skipped entirely (deleted, or not a raster image). */
  skipped?: 'missing' | 'non-raster'
}

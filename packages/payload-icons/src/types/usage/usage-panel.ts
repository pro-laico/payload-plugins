import type { IconUsageManifest } from '../scan/usage-manifest'

/** A name requested at runtime that didn't resolve (from the `iconRequest` collection). */
export interface LiveRequest {
  name: string
  count: number
  lastRequestedAt: string | null
}

export interface IconUsagePanelClientProps {
  /** The build-time manifest, or `null` when it hasn't been generated yet. */
  manifest: IconUsageManifest | null
  /** CLI command shown in the empty state so the editor knows how to populate it. */
  scanCommand: string
  /** Runtime misses recorded in production (empty unless `trackRequests` is on). */
  liveRequests: LiveRequest[]
}

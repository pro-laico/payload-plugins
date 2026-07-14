export type PrewarmReason = 'create' | 'replace' | 'focal' | 'manual'

export interface PrewarmSourceResult {
  targets: number
  generated: number
  failed: number
  skipped?: 'missing' | 'non-raster'
}

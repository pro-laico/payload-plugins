import type { PresetSpec } from '../presets/preset'

export interface PresetManagerProps {
  templates?: Record<string, PresetSpec>
  /** Slug of the generated-variants collection the panel lists and purges. */
  variantSlug?: string
  /** Purge endpoint path under the API route (POSTed as `${purgePath}/:id`). */
  purgePath?: string
  /** Prewarm endpoint path under the API route (GET/POST `${prewarmPath}/:id`). Absent = prewarm UI hidden. */
  prewarmPath?: string
  /** Preset-status endpoint path (GET `${presetsPath}/:id`) — maps presets to their cached variants. */
  presetsPath?: string
  /** Variants per page in the folded-in cache list. */
  pageSize?: number
}

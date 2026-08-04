import type { PresetSpec } from '../presets/preset'
import type { TransformConstraints } from '../transform/transformConstraints'

/** Snap-grid subset the panel's tick line needs — serializable for clientProps. */
export type TickConstraints = Pick<TransformConstraints, 'dimensionStep' | 'maxDimension' | 'widthLadder'>

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
  /** Transform snap constraints — drives the tick line's reachable-width hairlines and axis scale. */
  constraints?: TickConstraints
}

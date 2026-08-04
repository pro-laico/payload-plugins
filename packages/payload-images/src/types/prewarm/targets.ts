import type { RenderProfileDoc } from './profile'
import type { OutputFormat } from '../transform/format'
import type { ResolvedPrewarmStrategy } from './strategy'
import type { CacheKeyDoc } from '../transform/variantCacheKey'
import type { ParsedParams } from '../transform/transformParams'
import type { TransformConstraints } from '../transform/transformConstraints'

export interface PrewarmTarget {
  params: ParsedParams
  format: OutputFormat
  key: string
}

export type PrewarmSourceDoc = CacheKeyDoc & { width?: number | null; height?: number | null }

export interface ComputeTargetsArgs {
  source: PrewarmSourceDoc
  profiles: RenderProfileDoc[]
  strategy: ResolvedPrewarmStrategy
  formats: OutputFormat[]
  constraints: TransformConstraints
  existingKeys: ReadonlySet<string>
  maxVariantsPerImage: number
  now?: Date
}

export interface ComputeTargetsResult {
  targets: PrewarmTarget[]
  /** The plan hit `maxVariantsPerImage` — some derivable variants are not in it. */
  truncated: boolean
}

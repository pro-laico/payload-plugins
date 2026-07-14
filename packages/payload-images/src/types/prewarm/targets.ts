import type { RenderProfileDoc } from './profile'
import type { RenderProfileSeed } from './options'
import type { OutputFormat } from '../transform/format'
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
  seeds: RenderProfileSeed[]
  formats: OutputFormat[]
  constraints: TransformConstraints
  existingKeys: ReadonlySet<string>
  maxVariantsPerImage: number
  now?: Date
}

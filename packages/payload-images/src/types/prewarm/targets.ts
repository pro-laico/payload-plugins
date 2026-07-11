/** The prewarm target list: concrete variants a job will generate for one source. */
import type { OutputFormat } from '../transform/format'
import type { ParsedParams } from '../transform/transformParams'
import type { CacheKeyDoc } from '../transform/variantCacheKey'
import type { TransformConstraints } from '../transform/transformConstraints'
import type { RenderProfileSeed } from './options'
import type { RenderProfileDoc } from './profile'

/** One variant to generate: endpoint-identical params + a concrete format + its cache key. */
export interface PrewarmTarget {
  params: ParsedParams
  format: OutputFormat
  key: string
}

/** The source doc slice target computation reads (cache-key identity + intrinsic size). */
export type PrewarmSourceDoc = CacheKeyDoc & { width?: number | null; height?: number | null }

export interface ComputeTargetsArgs {
  source: PrewarmSourceDoc
  /** Registry docs as fetched — TTL filtering and ranking happen inside. */
  profiles: RenderProfileDoc[]
  /** Config-pinned profiles (never expire, never written to the registry). */
  seeds: RenderProfileSeed[]
  /** Concrete formats an `auto` observation expands into. */
  formats: OutputFormat[]
  /** The transform endpoint's resolved constraints — replayed for byte-identical snapping. */
  constraints: TransformConstraints
  /** cacheKeys already present in the variant collection for this source. */
  existingKeys: ReadonlySet<string>
  maxVariantsPerImage: number
  /** Injectable clock for TTL tests. */
  now?: Date
}

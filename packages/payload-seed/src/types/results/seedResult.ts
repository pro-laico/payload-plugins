import type { DeferredField } from '../graph/graph'

export interface SeedResult {
  /** Created doc counts keyed by collection slug. */
  created: Record<string, number>
  /** Collection slugs the run touched — cleared and reseeded, even when zero records were created. */
  collections: string[]
  /** Global slugs the run seeded. */
  globals: string[]
  /** The computed topological create order (doc node ids, `collection:_key`). */
  order: string[]
  /** Fields deferred to break a `ref` cycle: created null, then set in a second pass. */
  deferred: DeferredField[]
  /** Definitions skipped this run (their own `disabled`, or the collection's `custom.seedDisabled`). */
  skipped: SkippedDefinition[]
}

export interface SkippedDefinition {
  slug: string
  reason: string
}

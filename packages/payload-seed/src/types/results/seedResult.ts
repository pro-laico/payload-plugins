import type { DeferredField } from '../graph/graph'

export interface SeedResult {
  created: Record<string, number>
  collections: string[]
  globals: string[]
  order: string[]
  deferred: DeferredField[]
  skipped: SkippedDefinition[]
}

export interface SkippedDefinition {
  slug: string
  reason: string
}

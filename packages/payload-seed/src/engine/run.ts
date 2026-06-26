import type { Payload, PayloadRequest } from 'payload'
import type { ResolvedSeedOptions } from '../options'
import type { SeedDefinition } from '../types'

export interface SeedResult {
  /** Created doc counts keyed by collection slug. */
  created: Record<string, number>
  /** The computed topological create order (collection slugs). */
  order: string[]
}

export interface RunSeedArgs {
  payload: Payload
  req: PayloadRequest
  options: ResolvedSeedOptions
  /** Seed definitions. When omitted, the engine auto-discovers them via `options.discover`. */
  definitions?: SeedDefinition[]
}

/**
 * The seed engine entry point. Discovers (or accepts) seed definitions, uploads
 * referenced assets, builds + validates + topologically sorts the dependency graph,
 * clears the seeded collections, creates everything in order resolving ref/asset tokens
 * to ids, emits the dependency graph artifact, and revalidates.
 *
 * NOTE: Not yet implemented — this is the scaffolded entry the endpoint/CLI call into.
 * See DESIGN.md "Engine" for the full pipeline. Implemented incrementally:
 *   discover → assets → graph → validate → topo-sort → clear → create → artifact → revalidate.
 */
export async function runSeed(_args: RunSeedArgs): Promise<SeedResult> {
  throw new Error('[payload-seed] engine not yet implemented — see packages/payload-seed/DESIGN.md')
}

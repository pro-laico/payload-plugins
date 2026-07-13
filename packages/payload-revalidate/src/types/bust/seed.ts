import type { Tags } from '../cache/tagOptions'
import type { DependencyRule } from '../plugin/dependencyRule'

/** The slice of payload-seed's `SeedResult` this listener reads (structural — no import). */
export interface SeedResultLike {
  /** Docs created per collection slug. */
  created: Record<string, number>
  /** Collection slugs the run touched (cleared even when zero records were created). */
  collections?: string[]
  /** Global slugs the run seeded. */
  globals?: string[]
}

/** Everything the after-seed flush needs, handed over by the plugin factory's closure —
 *  the listener runs long after config build, with no request and no global state to read. */
export interface SeedFlushState {
  tags: Tags
  /** Per-collection declared list scopes — every scope busts on a reseed. */
  lists: Record<string, string[]>
  /** Per-collection static extra tags — see the flush rationale in `seedBusts`. */
  extraTags: Record<string, string[]>
  rules: DependencyRule[]
  observe: boolean
}

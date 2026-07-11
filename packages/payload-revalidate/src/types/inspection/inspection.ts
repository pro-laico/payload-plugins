import type { DependencyRule } from '../plugin/dependencyRule'
import type { ObservedRead, RevalidateEvent } from '../observe/observe'
import type { ReferenceGraph } from '../reference-graph/referenceGraph'
import type { ScannedGetter } from '../scan/scan'

/** One collection's resolved revalidation shape, for the dev map's per-field blast-radius view. */
export interface InspectedCollection {
  idField: string | false
  /** Declared list scopes → their determinant fields. */
  lists: Record<string, string[]>
  extraTags: string[]
  /** Every top-level data field — the rows of the blast-radius table. */
  fields: string[]
}

export interface RevalidateInspection {
  graph: ReferenceGraph
  prefix: string
  observing: boolean
  rules: DependencyRule[]
  /** Per-collection resolved settings (opted-out collections absent). */
  settings: Record<string, InspectedCollection>
  /** Getter call sites found by the live source scan (dev-only; [] in prod). */
  getters: ScannedGetter[]
  reads: ObservedRead[]
  events: RevalidateEvent[]
}

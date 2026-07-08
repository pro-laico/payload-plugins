import type { ReferenceGraph } from '../graph/referenceGraph'
import type { ObservedRead, RevalidateEvent } from '../observe/registry'
import type { ScannedGetter } from '../scan/live'
import type { DependencyRule } from '../types'

/**
 * The live inspection handoff for decoupled tooling (the map endpoint and
 * `@pro-laico/payload-dev-tools`): a function on a `Symbol.for` globalThis slot, NOT on
 * `config.custom` — `custom` feeds the serialized client config, so functions don't
 * belong there. The plugin factory stashes it; readers call {@link getInspection} (or
 * read the symbol directly to stay import-free).
 */
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

const INSPECT_SLOT = Symbol.for('pro-laico.payload-revalidate.inspect')

/** Called from the plugin factory: stash the live inspection getter. */
export const stashInspect = (fn: () => RevalidateInspection): void => {
  ;(globalThis as Record<symbol, unknown>)[INSPECT_SLOT] = fn
}

/** The current inspection snapshot, or `null` when the plugin isn't active in this process. */
export const getInspection = (): RevalidateInspection | null => {
  const fn = (globalThis as Record<symbol, unknown>)[INSPECT_SLOT] as (() => RevalidateInspection) | undefined
  return fn ? fn() : null
}

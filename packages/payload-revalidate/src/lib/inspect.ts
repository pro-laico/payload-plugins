import type { RevalidateInspection } from '../types'

/**
 * The live inspection handoff for decoupled tooling (the map endpoint and
 * `@pro-laico/payload-dev-tools`): a function on a `Symbol.for` globalThis slot, NOT on
 * `config.custom` — `custom` feeds the serialized client config, so functions don't
 * belong there. The plugin factory stashes it; readers call {@link getInspection} (or
 * read the symbol directly to stay import-free).
 */

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

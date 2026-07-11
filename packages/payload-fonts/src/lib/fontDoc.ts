/**
 * Read a `Font` typeface doc's upload slots — the `variable` group and the `weights` array. A
 * small leaf shared by the collection's field conditions and its validate/optimize/cleanup hooks,
 * so the slot-reading rules live in exactly one place (collection → hooks → this leaf, never back).
 */
import { refId } from './refs'

export type Ref = string | number | { id?: string | number } | null | undefined

type VariableGroup = { upright?: unknown; italic?: unknown }

/** True when the `variable` group carries at least one file (upright or italic). */
export const hasVariable = (data: Record<string, unknown> | undefined): boolean => {
  const v = (data?.variable ?? {}) as VariableGroup
  return Boolean(v.upright || v.italic)
}

/** True when the `weights` array has at least one row carrying a file. */
export const hasWeights = (data: Record<string, unknown> | undefined): boolean =>
  Array.isArray(data?.weights) && (data.weights as Array<{ file?: unknown }>).some((w) => w?.file)

/**
 * Every `fontOriginal` id a typeface doc references across all of its slots. Each original
 * belongs to exactly one typeface — enforced by the create-only upload slots (UI) and the
 * `rejectSharedOriginals` guard (data layer) — so cleanup can delete a de-referenced or
 * deleted original outright, with no shared-original / concurrent-delete hazard.
 */
export const originalIdsFromDoc = (data: Record<string, unknown>): Array<string | number> => {
  const ids: Array<string | number> = []
  const variable = (data.variable ?? {}) as { upright?: Ref; italic?: Ref }
  for (const r of [variable.upright, variable.italic]) {
    const id = refId(r)
    if (id != null) ids.push(id)
  }
  for (const row of (Array.isArray(data.weights) ? data.weights : []) as Array<{ file?: Ref }>) {
    const id = refId(row.file)
    if (id != null) ids.push(id)
  }
  return ids
}

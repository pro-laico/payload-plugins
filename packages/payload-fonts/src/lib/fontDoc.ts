import { refId } from './refs'
import type { Ref, VariableGroup } from '../types'

export const hasVariable = (data: Record<string, unknown> | undefined): boolean => {
  const v = (data?.variable ?? {}) as VariableGroup //TODO: replace `as` cast with proper typing
  return Boolean(v.upright || v.italic)
}

export const hasWeights = (data: Record<string, unknown> | undefined): boolean =>
  //TODO: replace `as` cast with proper typing
  Array.isArray(data?.weights) && (data.weights as Array<{ file?: unknown }>).some((w) => w?.file)

export const originalIdsFromDoc = (data: Record<string, unknown>): Array<string | number> => {
  const ids: Array<string | number> = []
  const variable = (data.variable ?? {}) as { upright?: Ref; italic?: Ref } //TODO: replace `as` cast with proper typing
  for (const r of [variable.upright, variable.italic]) {
    const id = refId(r)
    if (id != null) ids.push(id)
  }
  for (const row of (Array.isArray(data.weights) ? data.weights : []) as Array<{ file?: Ref }>) {
    //TODO: replace `as` cast with proper typing
    const id = refId(row.file)
    if (id != null) ids.push(id)
  }
  return ids
}

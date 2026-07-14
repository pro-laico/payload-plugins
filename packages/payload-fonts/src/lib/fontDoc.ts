import { refId } from './refs'
import { isRecord } from './isRecord'

export const hasVariable = (data: Record<string, unknown> | undefined): boolean => {
  const v: Record<string, unknown> = isRecord(data?.variable) ? data.variable : {}
  return Boolean(v.upright || v.italic)
}

export const hasWeights = (data: Record<string, unknown> | undefined): boolean =>
  Array.isArray(data?.weights) && data.weights.some((w) => isRecord(w) && w.file)

export const originalIdsFromDoc = (data: Record<string, unknown>): Array<string | number> => {
  const ids: Array<string | number> = []
  const variable: Record<string, unknown> = isRecord(data.variable) ? data.variable : {}
  for (const r of [variable.upright, variable.italic]) {
    const id = refId(r)
    if (id != null) ids.push(id)
  }
  for (const row of Array.isArray(data.weights) ? data.weights : []) {
    const id = refId(isRecord(row) ? row.file : undefined)
    if (id != null) ids.push(id)
  }
  return ids
}

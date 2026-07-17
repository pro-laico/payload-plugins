import { isRecord } from '../../_kit'
import type { ChangeDetectionSchema } from '../../types'

const normalizeRelation = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeRelation)
  if (isRecord(value)) {
    if ('relationTo' in value && 'value' in value) return `${String(value.relationTo)}:${String(normalizeRelation(value.value))}`
    if ('id' in value) return value.id
  }
  return value
}

export const changedFields = (doc: unknown, previousDoc: unknown, schema: ChangeDetectionSchema = {}): Set<string> | null => {
  if (!isRecord(doc) || !isRecord(previousDoc)) return null
  const a = doc
  const b = previousDoc
  const changed = new Set<string>()
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'updatedAt' || key === 'createdAt') continue
    if (schema.ignoreFields?.includes(key)) continue
    const normalize = schema.relationFields?.includes(key)
    const left = normalize ? normalizeRelation(a[key]) : a[key]
    const right = normalize ? normalizeRelation(b[key]) : b[key]
    if (JSON.stringify(left) !== JSON.stringify(right)) changed.add(key)
  }
  return changed
}

const valueAt = (data: unknown, path: string[]): unknown => {
  let current = data
  for (const key of path) {
    if (Array.isArray(current)) return current
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

export const pathChanged = (doc: unknown, previousDoc: unknown, field: string): boolean => {
  const path = field.split('.')
  return JSON.stringify(valueAt(doc, path)) !== JSON.stringify(valueAt(previousDoc, path))
}

export const anyChanged = (changed: Set<string> | null, fields: string[], docs?: { doc: unknown; previousDoc: unknown }): boolean => {
  if (changed === null) return true
  return fields.some((field) => {
    const dot = field.indexOf('.')
    if (dot === -1) return changed.has(field)
    if (!changed.has(field.slice(0, dot))) return false
    return docs ? pathChanged(docs.doc, docs.previousDoc, field) : true
  })
}

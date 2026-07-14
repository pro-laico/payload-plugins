import type { ChangeDetectionSchema } from '../../types'

const normalizeRelation = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeRelation)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown> //TODO: replace `as` cast with proper typing
    if ('relationTo' in record && 'value' in record) return `${String(record.relationTo)}:${String(normalizeRelation(record.value))}`
    if ('id' in record) return record.id
  }
  return value
}

export const changedFields = (doc: unknown, previousDoc: unknown, schema: ChangeDetectionSchema = {}): Set<string> | null => {
  if (typeof doc !== 'object' || doc === null || typeof previousDoc !== 'object' || previousDoc === null) return null
  const a = doc as Record<string, unknown> //TODO: replace `as` cast with proper typing
  const b = previousDoc as Record<string, unknown> //TODO: replace `as` cast with proper typing
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
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key] //TODO: replace `as` cast with proper typing
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

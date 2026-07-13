import type { ChangeDetectionSchema } from '../../types'

/** Reduce a relationship-shaped value to a stable id form: populated doc → id, polymorphic
 *  wrapper → `relationTo:id`, arrays element-wise; ids and null pass through. */
const normalizeRelation = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeRelation)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if ('relationTo' in record && 'value' in record) return `${String(record.relationTo)}:${String(normalizeRelation(record.value))}`
    if ('id' in record) return record.id
  }
  return value
}

export const changedFields = (doc: unknown, previousDoc: unknown, schema: ChangeDetectionSchema = {}): Set<string> | null => {
  if (typeof doc !== 'object' || doc === null || typeof previousDoc !== 'object' || previousDoc === null) return null
  const a = doc as Record<string, unknown>
  const b = previousDoc as Record<string, unknown>
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

/** Deep value at a dotted path. Traversal stops at the first array and returns the array
 *  itself — the caller then compares the whole subtree, which can over-fire on unrelated
 *  row edits but never under-fires. */
const valueAt = (data: unknown, path: string[]): unknown => {
  let current = data
  for (const key of path) {
    if (Array.isArray(current)) return current
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** Whether the value at a dotted path differs between the two docs. */
export const pathChanged = (doc: unknown, previousDoc: unknown, field: string): boolean => {
  const path = field.split('.')
  return JSON.stringify(valueAt(doc, path)) !== JSON.stringify(valueAt(previousDoc, path))
}

/**
 * Whether any of `fields` changed. A `null` baseline (create/delete) counts as changed.
 * Dotted paths (`contact.email`, `meta.featured`) are supported: the shallow diff only
 * carries top-level keys, so a dotted declaration first checks its container key, then
 * (when `docs` is provided) compares the exact path value on both docs.
 */
export const anyChanged = (changed: Set<string> | null, fields: string[], docs?: { doc: unknown; previousDoc: unknown }): boolean => {
  if (changed === null) return true
  return fields.some((field) => {
    const dot = field.indexOf('.')
    if (dot === -1) return changed.has(field)
    if (!changed.has(field.slice(0, dot))) return false
    return docs ? pathChanged(docs.doc, docs.previousDoc, field) : true
  })
}

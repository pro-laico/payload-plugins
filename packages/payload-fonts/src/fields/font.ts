import type { RelationshipField, RowField } from 'payload'

import { resolveFontFamilies } from '../lib/families'
import type { FontUploadFieldsOptions } from '../types'

export const fontUploadFields = ({ fontSlug, families }: FontUploadFieldsOptions): RowField[] => {
  const relationTo = fontSlug
  const resolved = resolveFontFamilies(families)
  const slots: RelationshipField[] = resolved.map((family) => ({
    name: family.key,
    label: family.label,
    type: 'relationship',
    relationTo,
    filterOptions: { family: { equals: family.key } },
  }))

  const rows: RowField[] = []
  for (let i = 0; i < slots.length; i += 2) {
    rows.push({ type: 'row', fields: slots.slice(i, i + 2) })
  }
  return rows
}

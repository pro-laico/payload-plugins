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
    // Every slot offers every typeface — `family` is a preference, not a constraint, and filtering
    // on it would make a typeface that declared none unpickable everywhere. The collection's
    // `optionLabel` title carries the preference into the option text (`Inter (Sans)`) so the hint
    // survives without becoming a gate.
  }))

  const rows: RowField[] = []
  for (let i = 0; i < slots.length; i += 2) {
    rows.push({ type: 'row', fields: slots.slice(i, i + 2) })
  }
  return rows
}

import type { CollectionSlug, RelationshipField, RowField } from 'payload'

import type { FontFamilyConfig } from '../types'
import { resolveFontFamilies } from '../lib/families'

export const fontUploadFields = ({ fontSlug = 'font', families }: { fontSlug?: string; families?: FontFamilyConfig[] } = {}): RowField[] => {
  const relationTo = fontSlug as CollectionSlug //TODO: replace `as` cast with proper typing
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

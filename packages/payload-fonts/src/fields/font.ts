import type { CollectionSlug, Field } from 'payload'

import { type FontRoleConfig, resolveFontRoles } from '../lib/roles'

/**
 * The per-role relationship fields for the `fontSet` global — one slot per configured role
 * (`sans / serif / mono / display` by default), pointing at this package's `font` typeface
 * collection and laid out two-per-row. Used by the standalone `fontSet` global
 * (`globals/fontSet.ts`), and exported so a project assembling its own selection surface (a
 * different global, or a group on an existing collection) can reuse the exact same slots.
 */
export const fontUploadFields = ({ fontSlug = 'font', roles }: { fontSlug?: string; roles?: FontRoleConfig[] } = {}): Field[] => {
  const relationTo = fontSlug as CollectionSlug
  const resolved = resolveFontRoles(roles)
  // Each slot selects ONE typeface (`font`) whose `family` role matches. A typeface carries its
  // own weight files, which the download generator collapses into a single `next/font/local`
  // declaration (one `src` per file). The slot is a single relationship — the multiplicity
  // lives inside the typeface, not here.
  const slots: Field[] = resolved.map((role) => ({
    name: role.key,
    label: role.label,
    type: 'relationship',
    relationTo,
    filterOptions: { family: { equals: role.key } },
  }))

  // Lay the slots out two per row, matching the original sans/serif | mono/display grid.
  const rows: Field[] = []
  for (let i = 0; i < slots.length; i += 2) {
    rows.push({ type: 'row', fields: slots.slice(i, i + 2) })
  }
  return rows
}

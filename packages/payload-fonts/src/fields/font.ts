import type { CollectionSlug, Field } from 'payload'

/**
 * The four font-slot relationship fields (sans / serif / mono / display), laid out as two
 * rows and pointing at this package's `font` typeface collection. Used by the standalone
 * `fontSet` global (`globals/fontSet.ts`), and exported so a project assembling its own
 * selection surface (a different global, or a group on an existing collection) can reuse the
 * exact same slots.
 */
export const fontUploadFields = ({ fontSlug = 'font' }: { fontSlug?: string } = {}): Field[] => {
  const relationTo = fontSlug as CollectionSlug
  // Each slot selects ONE typeface (`font`) whose `family` role matches. A typeface carries its
  // own weight files, which the download generator collapses into a single `next/font/local`
  // declaration (one `src` per file). The slot is a single relationship — the multiplicity
  // lives inside the typeface, not here.
  return [
    {
      type: 'row',
      fields: [
        { name: 'sans', type: 'relationship', relationTo, filterOptions: { family: { equals: 'sans' } } },
        { name: 'serif', type: 'relationship', relationTo, filterOptions: { family: { equals: 'serif' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'mono', type: 'relationship', relationTo, filterOptions: { family: { equals: 'mono' } } },
        { name: 'display', type: 'relationship', relationTo, filterOptions: { family: { equals: 'display' } } },
      ],
    },
  ]
}

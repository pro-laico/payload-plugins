import type { GlobalConfig } from 'payload'

import type { FontFamilyConfig } from '../types'
import { authd } from '../access'
import { fontUploadFields } from '../fields/font'

/** Slug of the standalone font-selection global. */
export const FONT_SET_SLUG = 'fontSet'

/**
 * A singleton global holding the active font choices — one slot per configured family (sans /
 * serif / mono / display by default). The fonts export endpoint reads it to resolve which
 * typefaces to ship, so a project can drive `next/font/local` from a CMS-managed selection.
 * Registered by `fontsPlugin()` by default (pass `includeFontSet: false` to skip it).
 */
export const createFontSetGlobal = ({
  fontSlug = 'font',
  families,
}: {
  fontSlug?: string
  families?: FontFamilyConfig[]
} = {}): GlobalConfig => ({
  slug: FONT_SET_SLUG,
  admin: {
    group: 'Assets',
    description:
      'Choose which uploaded typeface fills each slot. This is what actually puts a font on your site — upload in Font first, then activate it here.',
  },
  access: { read: authd, update: authd },
  fields: fontUploadFields({ fontSlug, families }),
})

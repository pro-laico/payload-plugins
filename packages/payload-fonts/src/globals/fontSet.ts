import type { GlobalConfig } from 'payload'

import { authd } from '../access/authd'
import { fontUploadFields } from '../fields/font'
import type { FontFamilyConfig } from '../lib/families'

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
  admin: { group: 'Assets' },
  access: { read: authd, update: authd },
  fields: fontUploadFields({ fontSlug, families }),
})

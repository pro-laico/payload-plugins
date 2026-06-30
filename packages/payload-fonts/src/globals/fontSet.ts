import type { GlobalConfig } from 'payload'

import { authd } from '../access/authd'
import { fontUploadFields } from '../fields/font'

/** Slug of the standalone font-selection global. */
export const FONT_SET_SLUG = 'fontSet'

/**
 * A singleton global holding the active sans / serif / mono / display font choices. The fonts
 * export endpoint reads it to resolve which typefaces to ship, so a project can drive
 * `next/font/local` from a CMS-managed selection. Registered by `fontsPlugin()` by default
 * (pass `includeFontSet: false` to skip it).
 */
export const createFontSetGlobal = ({ fontSlug = 'font' }: { fontSlug?: string } = {}): GlobalConfig => ({
  slug: FONT_SET_SLUG,
  admin: { group: 'Assets' },
  access: { read: authd, update: authd },
  fields: fontUploadFields({ fontSlug }),
})

/** Default `fontSet` global bound to the `font` collection. */
export const FontSet: GlobalConfig = createFontSetGlobal()

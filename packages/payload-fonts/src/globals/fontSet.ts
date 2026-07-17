import type { GlobalConfig } from 'payload'

import { authd } from '../_kit'
import { fontUploadFields } from '../fields/font'
import type { CreateFontSetGlobalOptions } from '../types'

/** The default slug — see the note on `FONT_SLUG`. */
export const FONT_SET_SLUG = 'fontSet'

const d = {
  fontSet:
    'Choose which uploaded typeface fills each slot. This is what actually puts a font on your site — upload in Font first, then activate it here.',
}

export const createFontSetGlobal = ({ slug, fontSlug, families }: CreateFontSetGlobalOptions): GlobalConfig => ({
  slug,
  admin: { group: 'Assets', description: d.fontSet },
  access: { read: authd, update: authd },
  fields: fontUploadFields({ fontSlug, families }),
})

import type { GlobalConfig } from 'payload'

import { authd } from '../access'
import type { FontFamilyConfig } from '../types'
import { fontUploadFields } from '../fields/font'

export const FONT_SET_SLUG = 'fontSet'

const d = {
  fontSet:
    'Choose which uploaded typeface fills each slot. This is what actually puts a font on your site — upload in Font first, then activate it here.',
}

export const createFontSetGlobal = ({
  fontSlug = 'font',
  families,
}: {
  fontSlug?: string
  families?: FontFamilyConfig[]
} = {}): GlobalConfig => ({
  slug: FONT_SET_SLUG,
  admin: { group: 'Assets', description: d.fontSet },
  access: { read: authd, update: authd },
  fields: fontUploadFields({ fontSlug, families }),
})

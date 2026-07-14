import type { CollectionConfig } from 'payload'

import { authd } from '../access'

export const FONT_ORIGINAL_SLUG = 'fontOriginal'

export const FONT_MIME_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'font/sfnt',
  'application/font-sfnt',
  'application/vnd.ms-opentype',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/x-font-truetype',
]

export const createFontOriginalCollection = ({ slug = FONT_ORIGINAL_SLUG }: { slug?: string } = {}): CollectionConfig => ({
  slug,
  access: { create: authd, delete: authd, read: authd, update: authd },
  custom: { revalidate: false },
  admin: { group: 'Assets', hidden: true, enableListViewSelectAPI: true, useAsTitle: 'filename' },
  upload: { mimeTypes: FONT_MIME_TYPES },
  fields: [],
})

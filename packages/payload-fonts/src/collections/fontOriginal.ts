import type { CollectionConfig } from 'payload'

import { authd } from '../_kit'
import type { CreateFontOriginalCollectionOptions } from '../types'

/** The default slug — see the note on `FONT_SLUG`. */
export const FONT_ORIGINAL_SLUG = 'fontOriginal'

/**
 * Payload validates the mime the BROWSER reports, and a browser only relays what the OS claims.
 * Windows registers no content type for any font extension, so Chrome sends
 * `application/octet-stream` and a list of font types alone rejects every upload — the same file
 * uploads fine from macOS, which supplies the type via UTI. Hence the last entry, and the
 * extensions: the admin builds the file picker's `accept` by joining this list, and `accept` matches
 * extensions as well as types, so they're what keeps the picker naming fonts rather than "all files".
 *
 * This list is a picker filter, not a security boundary — the collection is logged-in-only, and a
 * file that isn't a font fails the subsetter on save and simply serves no weight.
 */
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
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.ttc',
  'application/octet-stream',
]

export const createFontOriginalCollection = ({ slug }: CreateFontOriginalCollectionOptions): CollectionConfig => ({
  slug,
  access: { create: authd, delete: authd, read: authd, update: authd },
  custom: { revalidate: false },
  admin: { group: 'Assets', hidden: true, enableListViewSelectAPI: true, useAsTitle: 'filename' },
  upload: { mimeTypes: FONT_MIME_TYPES },
  fields: [],
})

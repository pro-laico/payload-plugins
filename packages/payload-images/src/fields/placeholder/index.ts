/**
 * The virtual `placeholder` field — the read side of the placeholder pipeline (behavior in
 * its afterRead, hooks/field/placeholder) plus the stored tier fields the upload hook writes.
 */
import type { Field } from 'payload'

import { PLACEHOLDER_FIELD_NAMES } from '../../lib/placeholders/qualities'
import { placeholderAfterRead } from '../../hooks/field/placeholder'

export type { PlaceholderFormat } from '../../lib/placeholders/qualities'
export type { BlurhashRequest } from '../../types'

const d = {
  placeholder:
    'Placeholder for the read: a finished data URI focal-cropped to the declared render (context.image.aspectRatio + context.blur = { quality, format }, or an X-Blurhash header); the raw sm-tier hash when nothing is declared.',
}

export const placeholderField = (): Field => ({
  name: 'placeholder',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.placeholder },
  hooks: { afterRead: [placeholderAfterRead] },
})

/** The stored placeholder tier fields — written by the upload hook, hidden in the admin. */
export const blurhashStorageFields = (): Field[] =>
  PLACEHOLDER_FIELD_NAMES.map((name) => ({ name, type: 'text', admin: { hidden: true, readOnly: true } }))

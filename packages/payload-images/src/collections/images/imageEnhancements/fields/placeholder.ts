import type { TextField } from 'payload'

import { placeholderAfterRead } from '../../../../hooks/field/placeholder'
import { PLACEHOLDER_FIELD_NAMES } from '../../../../lib/placeholders/qualities'

const d = {
  placeholder:
    'Placeholder for the read: a finished data URI focal-cropped to the declared render (context.image.aspectRatio + context.blur = { quality, format }, or an X-Blurhash header); the raw sm-tier hash when nothing is declared.',
}

export const placeholderField: TextField = {
  name: 'placeholder',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.placeholder },
  hooks: { afterRead: [placeholderAfterRead] },
}

export const placeholderStorageFields: TextField[] = PLACEHOLDER_FIELD_NAMES.map((name) => ({
  name,
  type: 'text',
  admin: { hidden: true, readOnly: true },
}))

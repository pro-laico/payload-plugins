import type { TextField } from 'payload'

import { placeholderAfterRead } from '../../../../hooks/field/placeholder'
import { PLACEHOLDER_FIELD_NAMES } from '../../../../lib/placeholders/qualities'

const d = {
  placeholder:
    'Placeholder for the read — opt-in: a finished data URI focal-cropped to the declared render, returned only when the read declares a blur (context.blur = { quality, format } or an X-Blurhash header); null otherwise so undeclared reads carry no data-URI weight.',
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

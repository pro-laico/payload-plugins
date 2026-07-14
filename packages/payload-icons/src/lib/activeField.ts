import type { CheckboxField } from 'payload'

const d = {
  activeField: 'Render this set across the frontend. Activating a set deactivates the others.',
}

export const activeField: CheckboxField = {
  name: 'active',
  type: 'checkbox',
  defaultValue: false,
  index: true,
  admin: { description: d.activeField, style: { maxWidth: '160px', alignSelf: 'center' } },
}

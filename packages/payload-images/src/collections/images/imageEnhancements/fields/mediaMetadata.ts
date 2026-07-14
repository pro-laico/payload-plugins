import type { CheckboxField, JSONField } from 'payload'

const d = {
  palette:
    'Color palette extracted at upload: dominant/vibrant/muted (+ dark/light variants), each { background, foreground, title, population }.',
  hasAlpha: 'The file carries an alpha channel.',
  isOpaque: 'No pixel is actually transparent (sampled).',
}

export const paletteField: JSONField = { name: 'palette', type: 'json', admin: { hidden: true, description: d.palette } }
export const hasAlphaField: CheckboxField = { name: 'hasAlpha', type: 'checkbox', admin: { hidden: true, description: d.hasAlpha } }
export const isOpaqueField: CheckboxField = { name: 'isOpaque', type: 'checkbox', admin: { hidden: true, description: d.isOpaque } }

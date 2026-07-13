/**
 * The per-image `presets` array — guaranteed, cap-exempt, eagerly generated variants. Hidden:
 * the presetManager admin component IS its UI. Each entry is a config-template reference
 * (`template`) or a custom inline spec (`name` + dimensions/fit/quality/format).
 */
import type { ArrayField } from 'payload'

import { FITS, FORMATS } from '../../../../lib/transform/params'

const d = {
  presets:
    'Guaranteed public variants for this image (OG, social, fixed sizes). Always generatable and pre-generated on upload; served via /api/img/:id?preset=<name>. Managed by the Presets panel.',
  template: 'Name of a plugin preset template to apply (leave blank for a custom preset).',
  name: 'Name for a custom preset (used when no template is chosen).',
}

export const presetsField = (): ArrayField => ({
  name: 'presets',
  type: 'array',
  admin: { hidden: true, description: d.presets },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'template', type: 'text', admin: { description: d.template } },
        { name: 'name', type: 'text', admin: { description: d.name } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'width', type: 'number', min: 1 },
        { name: 'height', type: 'number', min: 1 },
        { name: 'aspectRatio', type: 'text', admin: { description: 'e.g. 16:9' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'fit', type: 'select', options: [...FITS] },
        { name: 'quality', type: 'number', min: 1, max: 100 },
        { name: 'format', type: 'select', options: FORMATS.filter((f) => f !== 'auto') },
      ],
    },
  ],
})

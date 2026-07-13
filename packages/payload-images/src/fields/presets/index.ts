/**
 * The per-image `presets` (guaranteed, cap-exempt, eagerly generated variants) and `variantLimit`
 * (per-image cap override) fields. `presets` is a hidden array edited by the presetManager admin
 * component; each entry is a config-template reference (`template`) or a custom inline spec.
 */
import type { Field } from 'payload'

import { FITS, FORMATS } from '../../lib/transform/params'

export const PRESETS_FIELD_NAME = 'presets'
export const VARIANT_LIMIT_FIELD_NAME = 'variantLimit'

const d = {
  presets:
    'Guaranteed public variants for this image (OG, social, fixed sizes). Always generatable and pre-generated on upload; served via /api/img/:id?preset=<name>. Managed by the Presets panel.',
  template: 'Name of a plugin preset template to apply (leave blank for a custom preset).',
  name: 'Name for a custom preset (used when no template is chosen).',
  variantLimit:
    'Max cached variants for this image before new sizes are served from a nearby existing one instead of being generated + stored. Blank uses the project default. Presets never count against this.',
}

export const presetsField = (): Field => ({
  name: PRESETS_FIELD_NAME,
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

/** The per-image cap override; `defaultValue` seeds new docs with the project default. */
export const variantLimitField = (projectDefault?: number): Field => ({
  name: VARIANT_LIMIT_FIELD_NAME,
  type: 'number',
  min: 0,
  ...(projectDefault != null ? { defaultValue: projectDefault } : {}),
  admin: { description: d.variantLimit, position: 'sidebar' },
})

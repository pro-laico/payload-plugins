/**
 * The stored hotspot/crop fields — the non-destructive art-direction layers the focal preview
 * edits and the transform pipeline consumes (model in transform/geometry.ts). Hidden: the custom
 * component IS their UI. Deliberately NOT Payload's built-in "Edit image" crop, which rewrites
 * the uploaded file — these only shape what the endpoint renders.
 */
import type { Field } from 'payload'

export const HOTSPOT_FIELD_NAMES = ['focalSize', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom'] as const

const pctField = (name: string, description: string, defaultValue: number, min: number, max: number): Field => ({
  name,
  type: 'number',
  defaultValue,
  min,
  max,
  admin: { hidden: true, description },
})

export const hotspotFields = (): Field[] => [
  pctField('focalSize', 'Hotspot circle diameter, % of the crop region’s shorter side. 100 = maximal window (no zoom).', 100, 5, 100),
  pctField('cropLeft', 'Non-destructive edge trim, % of the image removed from the left.', 0, 0, 90),
  pctField('cropTop', 'Non-destructive edge trim, % removed from the top.', 0, 0, 90),
  pctField('cropRight', 'Non-destructive edge trim, % removed from the right.', 0, 0, 90),
  pctField('cropBottom', 'Non-destructive edge trim, % removed from the bottom.', 0, 0, 90),
]

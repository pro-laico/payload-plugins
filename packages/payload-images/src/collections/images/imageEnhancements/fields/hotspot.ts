import type { NumberField } from 'payload'

const d = {
  focalSize: 'Hotspot circle diameter, % of the crop region’s shorter side. 100 = maximal window (no zoom).',
  cropLeft: 'Non-destructive edge trim, % of the image removed from the left.',
  cropTop: 'Non-destructive edge trim, % removed from the top.',
  cropRight: 'Non-destructive edge trim, % removed from the right.',
  cropBottom: 'Non-destructive edge trim, % removed from the bottom.',
}

export const hotspotFields: NumberField[] = [
  { name: 'focalSize', type: 'number', defaultValue: 100, min: 5, max: 100, admin: { hidden: true, description: d.focalSize } },
  { name: 'cropLeft', type: 'number', defaultValue: 0, min: 0, max: 90, admin: { hidden: true, description: d.cropLeft } },
  { name: 'cropTop', type: 'number', defaultValue: 0, min: 0, max: 90, admin: { hidden: true, description: d.cropTop } },
  { name: 'cropRight', type: 'number', defaultValue: 0, min: 0, max: 90, admin: { hidden: true, description: d.cropRight } },
  { name: 'cropBottom', type: 'number', defaultValue: 0, min: 0, max: 90, admin: { hidden: true, description: d.cropBottom } },
]

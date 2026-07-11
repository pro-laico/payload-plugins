/** The stored metadata fields the analyzer fills at upload time: the color palette + alpha flags. */
import type { Field } from 'payload'

const d = {
  palette:
    'Color palette extracted at upload: dominant/vibrant/muted (+ dark/light variants), each { background, foreground, title, population }.',
}

export const MEDIA_METADATA_FIELD_NAMES = ['palette', 'hasAlpha', 'isOpaque'] as const

export const mediaMetadataFields = (): Field[] => [
  { name: 'palette', type: 'json', admin: { hidden: true, description: d.palette } },
  { name: 'hasAlpha', type: 'checkbox', admin: { hidden: true, description: 'The file carries an alpha channel.' } },
  { name: 'isOpaque', type: 'checkbox', admin: { hidden: true, description: 'No pixel is actually transparent (sampled).' } },
]

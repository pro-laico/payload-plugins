/**
 * The stored image-metadata fields the analyzer fills at upload time (alongside the blurhash
 * tiers in ./croppedBlurhash): the Sanity-style color palette and the alpha flags. Plain
 * stored data — hidden in the admin, riding along in reads for consumers (solid-color
 * placeholders, text theming, format decisions).
 */
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

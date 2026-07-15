import type { NumberField, TextField } from 'payload'

import {
  aspectRatioAfterRead,
  placeholderUrlAfterRead,
  srcAfterRead,
  srcsetAfterRead,
  thumbnailUrlAfterRead,
  variantVersionAfterRead,
} from '../../../../hooks/field/virtualUrls'

const d = {
  aspectRatio: 'The render aspect ratio: the ratio the read declared (context.image.aspectRatio), else the natural one.',
  variantVersion: 'Cache-busting version token for transform URLs (changes on file replace / focal / hotspot edits).',
  src: 'Optimized URL (≤1280px) for a plain <img> or OG tag, honoring the declared render.',
  srcset: 'Responsive srcset up to the source width, honoring the declared render (else the natural ratio).',
  placeholderURL: 'Tiny low-quality placeholder (LQIP) for a blur-up / CSS background.',
  thumbnailURL: 'Small focal-cropped square (160px) for cards, lists, and feeds.',
}

export const VIRTUAL_URL_INPUTS = [
  'width',
  'height',
  'filename',
  'filesize',
  'focalX',
  'focalY',
  'focalSize',
  'cropLeft',
  'cropTop',
  'cropRight',
  'cropBottom',
]

export const aspectRatioField: NumberField = {
  name: 'aspectRatio',
  type: 'number',
  virtual: true,
  admin: { hidden: true, description: d.aspectRatio },
  hooks: { afterRead: [aspectRatioAfterRead] },
}

export const variantVersionField: TextField = {
  name: 'variantVersion',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.variantVersion },
  hooks: { afterRead: [variantVersionAfterRead] },
}

export const srcField: TextField = {
  name: 'src',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.src },
  hooks: { afterRead: [srcAfterRead] },
}

export const srcsetField: TextField = {
  name: 'srcset',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.srcset },
  hooks: { afterRead: [srcsetAfterRead] },
}

export const placeholderUrlField: TextField = {
  name: 'placeholderURL',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.placeholderURL },
  hooks: { afterRead: [placeholderUrlAfterRead] },
}

export const thumbnailUrlField: TextField = {
  name: 'thumbnailURL',
  type: 'text',
  virtual: true,
  admin: { hidden: true, description: d.thumbnailURL },
  hooks: { afterRead: [thumbnailUrlAfterRead] },
}

import type { CollectionConfig } from 'payload'

import { authd, readScopedToSource } from '../access'
import { asSlug } from '../lib/asSlug'
import { IMAGE_MIME_TYPES } from '../lib/transform/params'
import type { CreateGeneratedImagesOptions } from '../types'

export const GENERATED_IMAGES_SLUG = 'generated-images'

export const createGeneratedImagesCollection = (opts: CreateGeneratedImagesOptions = {}): CollectionConfig => {
  const slug = opts.slug || GENERATED_IMAGES_SLUG
  const sourceSlug = asSlug(opts.sourceSlug || 'images')

  return {
    slug,
    access: { create: authd, delete: authd, read: readScopedToSource(sourceSlug), update: authd },
    custom: { revalidate: false },
    admin: {
      hidden: true,
      group: 'Assets',
      enableListViewSelectAPI: true,
      useAsTitle: 'cacheKey',
      defaultColumns: ['cacheKey', 'width', 'height', 'format'],
    },
    fields: [
      { name: 'source', type: 'relationship', relationTo: sourceSlug, required: true, index: true },
      { name: 'cacheKey', type: 'text', required: true, unique: true },
      {
        type: 'row',
        fields: [
          { name: 'fit', type: 'text' },
          { name: 'format', type: 'text' },
          { name: 'quality', type: 'number' },
          { name: 'windowed', type: 'checkbox' },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'focalX', type: 'number' },
          { name: 'focalY', type: 'number' },
        ],
      },
    ],
    upload: { mimeTypes: IMAGE_MIME_TYPES, displayPreview: false },
  }
}

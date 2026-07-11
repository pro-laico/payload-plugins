import type { CollectionConfig, CollectionSlug } from 'payload'

import { authd } from '../access'
import { IMAGE_MIME_TYPES } from '../lib/transform/params'
import type { CreateGeneratedImagesOptions } from '../types'

export const GENERATED_IMAGES_SLUG = 'generated-images'

/**
 * The hidden, durable cache of on-demand image variants — one upload doc per (source, settings,
 * focal) combination. An UPLOAD collection so variant bytes flow through whatever storage adapter
 * is configured; with cloud storage, register it with a SERVER-upload instance (the endpoint
 * creates docs via the Local API). Carries NO revalidation hooks on purpose: variants are derived
 * and disposable, so busting cache tags on every cache-miss create would be pure churn.
 */
export const createGeneratedImagesCollection = (opts: CreateGeneratedImagesOptions = {}): CollectionConfig => {
  const slug = opts.slug || GENERATED_IMAGES_SLUG
  const sourceSlug = (opts.sourceSlug || 'images') as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union

  return {
    slug,
    access: { create: authd, delete: authd, read: authd, update: authd },
    custom: { revalidate: false },
    admin: { hidden: true, group: 'Assets', useAsTitle: 'cacheKey', defaultColumns: ['cacheKey', 'width', 'height', 'format'] },
    fields: [
      { name: 'source', type: 'relationship', relationTo: sourceSlug, required: true, index: true },
      { name: 'cacheKey', type: 'text', required: true, unique: true },
      {
        type: 'row',
        fields: [
          { name: 'fit', type: 'text' },
          { name: 'format', type: 'text' },
          { name: 'quality', type: 'number' },
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
    upload: { mimeTypes: IMAGE_MIME_TYPES },
  }
}

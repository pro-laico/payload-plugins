import type { CollectionConfig } from 'payload'

import { authd } from '../access'
import { FONT_ORIGINAL_SLUG } from './fontOriginal'
import type { CreateFontOptimizedCollectionOptions } from '../types'

export const FONT_OPTIMIZED_SLUG = 'fontOptimized'

export const createFontOptimizedCollection = (opts: CreateFontOptimizedCollectionOptions = {}): CollectionConfig => {
  const fontSlug = opts.fontSlug || 'font'
  const originalSlug = opts.originalSlug || FONT_ORIGINAL_SLUG
  return {
    slug: FONT_OPTIMIZED_SLUG,
    access: { create: authd, delete: authd, read: () => true, update: authd },
    custom: { revalidate: false },
    admin: {
      group: 'Assets',
      hidden: true,
      enableListViewSelectAPI: true,
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'weight', 'style', 'isVariable'],
    },
    upload: { mimeTypes: ['font/woff2'] },
    fields: [
      {
        name: 'font',
        type: 'relationship',
        relationTo: fontSlug,
        admin: { readOnly: true },
      },
      {
        name: 'original',
        type: 'relationship',
        relationTo: originalSlug,
        admin: { readOnly: true },
      },
      { name: 'weight', type: 'text', admin: { readOnly: true } },
      { name: 'style', type: 'radio', options: ['normal', 'italic'], admin: { readOnly: true } },
      { name: 'isVariable', type: 'checkbox', admin: { readOnly: true } },
      { name: 'italCapable', type: 'checkbox', admin: { readOnly: true } },
      { name: 'obliqueAngle', type: 'number', admin: { readOnly: true, condition: (data) => Boolean(data?.italCapable) } },
    ],
  }
}

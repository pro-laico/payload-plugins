import type { CollectionConfig } from 'payload'

import { anyone, authd } from '../../access'
import type { CreateImagesOptions } from '../../types'
import { IMAGE_MIME_TYPES } from '../../lib/transform/params'
import { imageEnhancements, resolveAdminThumbnail } from './imageEnhancements'

const d = { alt: 'Describe the image for screen readers and SEO.' }

export const createImagesCollection = (opts: CreateImagesOptions = {}): CollectionConfig => {
  const { localizeAlt = false, folders, maxOriginalSize } = opts
  const enh = imageEnhancements(opts)
  const adminThumbnail = resolveAdminThumbnail(opts.adminThumbnail, opts.apiRoute)

  return {
    slug: 'images',
    access: { create: authd, delete: authd, read: anyone, update: authd },
    admin: {
      group: 'Assets',
      description: 'Upload images here. Display sizes are generated on demand and cached — store the original once, render any size.',
      enableListViewSelectAPI: true,
      useAsTitle: 'alt',
      defaultColumns: ['filename', 'alt', 'updatedAt'],
      listSearchableFields: ['alt', 'filename'],
    },
    defaultPopulate: enh.defaultPopulate,
    ...(enh.forceSelect ? { forceSelect: enh.forceSelect } : {}),
    ...(folders ? { folders: true } : {}),
    fields: [{ name: 'alt', type: 'text', required: true, localized: localizeAlt, admin: { description: d.alt } }, ...(enh.fields ?? [])],
    hooks: enh.hooks,
    upload: {
      focalPoint: true,
      displayPreview: true,
      mimeTypes: opts.mimeTypes ?? IMAGE_MIME_TYPES,
      ...(adminThumbnail ? { adminThumbnail } : {}),
      ...(maxOriginalSize
        ? { resizeOptions: { width: maxOriginalSize, height: maxOriginalSize, fit: 'inside', withoutEnlargement: true } }
        : {}),
    },
  }
}

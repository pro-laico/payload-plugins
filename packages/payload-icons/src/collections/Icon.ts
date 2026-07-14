import type { CollectionConfig } from 'payload'

import { mergeHooks } from '../lib/mergeHooks'
import type { IconCollectionOverrides } from '../types'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'
import { formatSVGHook } from '../hooks/collection/formatSVG'
import { defaultAdminAccess, defaultReadAccess } from '../access/defaultAccess'

export const ICON_SLUG = 'icon'

const IconPreviewFieldPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewField'
const IconPreviewCellPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewCell'

export const Icon = (options: IconCollectionOverrides = {}): CollectionConfig => {
  const { slug = ICON_SLUG, adminGroup = 'Assets', access, fields = [], hooks, upload } = options

  return {
    slug,
    labels: { singular: 'Icon', plural: 'Icons' },
    access: {
      read: access?.read ?? defaultReadAccess,
      create: access?.create ?? defaultAdminAccess,
      update: access?.update ?? defaultAdminAccess,
      delete: access?.delete ?? defaultAdminAccess,
    },
    admin: {
      group: adminGroup,
      enableListViewSelectAPI: true,
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'svgString', 'filesize', 'updatedAt'],
    },
    custom: { revalidate: { extraTags: [ICONS_REVALIDATE_TAG] } },
    upload: { mimeTypes: ['image/svg+xml'], allowRestrictedFileTypes: true, ...upload },
    fields: [
      {
        name: 'iconPreview',
        type: 'ui',
        admin: { components: { Field: IconPreviewFieldPath }, condition: (data) => Boolean(data?.svgString) },
      },
      { name: 'optimized', type: 'text', admin: { readOnly: true, condition: (data) => Boolean(data?.optimized) } },
      {
        name: 'svgString',
        type: 'code',
        admin: {
          components: { Cell: IconPreviewCellPath },
          language: 'xml',
          readOnly: true,
          condition: (data) => Boolean(data?.svgString),
          editorOptions: { wordWrap: 'off', scrollBeyondLastLine: false },
        },
      },
      ...fields,
    ],
    hooks: mergeHooks({ beforeChange: [formatSVGHook] }, hooks),
  }
}

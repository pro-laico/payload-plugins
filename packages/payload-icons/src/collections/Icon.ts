import type { CodeField, CollectionConfig, TextField, UIField } from 'payload'

import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'
import { formatSVGHook } from '../hooks/collection/formatSVG'
import { defaultAdminAccess, defaultReadAccess } from '../access/defaultAccess'

export const ICON_SLUG = 'icon'

const IconPreviewFieldPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewField'

const IconPreviewCellPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewCell'

const iconPreviewField: UIField = {
  name: 'iconPreview',
  type: 'ui',
  admin: { components: { Field: IconPreviewFieldPath }, condition: (data) => Boolean(data?.svgString) },
}

const optimizedField: TextField = { name: 'optimized', type: 'text', admin: { readOnly: true, condition: (data) => Boolean(data?.optimized) } }

const svgStringField: CodeField = {
  name: 'svgString',
  type: 'code',
  admin: {
    components: { Cell: IconPreviewCellPath },
    language: 'xml',
    readOnly: true,
    condition: (data) => Boolean(data?.svgString),
    editorOptions: { wordWrap: 'off', scrollBeyondLastLine: false },
  },
}

/** The base `icon` collection. `collections.icon` is merged onto it by the kit's `mergeCollection`. */
export const Icon = (): CollectionConfig => ({
  slug: ICON_SLUG,
  labels: { singular: 'Icon', plural: 'Icons' },
  access: { read: defaultReadAccess, create: defaultAdminAccess, update: defaultAdminAccess, delete: defaultAdminAccess },
  admin: {
    group: 'Assets',
    enableListViewSelectAPI: true,
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'svgString', 'filesize', 'updatedAt'],
  },
  custom: { revalidate: { extraTags: [ICONS_REVALIDATE_TAG] } },
  upload: { mimeTypes: ['image/svg+xml'], allowRestrictedFileTypes: true },
  fields: [iconPreviewField, optimizedField, svgStringField],
  hooks: { beforeChange: [formatSVGHook] },
})

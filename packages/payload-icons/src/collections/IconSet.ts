import type { ArrayField, CollectionConfig, RowField, TabsField, TextField, UIField, UploadField } from 'payload'

import { asSlug, authd } from '../_kit'
import { activeField } from '../lib/activeField'
import type { IconSetCollectionArgs } from '../types'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'
import { kebabCaseName } from '../hooks/field/kebabCaseName'
import { enforceSingleActive } from '../hooks/collection/enforceSingleActive'

const d = {
  iconRowName: 'The name the frontend looks the icon up by (auto kebab-cased).',
}

export const ICON_SET_SLUG = 'iconSet'

const IconUsagePanelPath = '@pro-laico/payload-icons/admin/iconUsagePanel'

const IconRowLabelPath = '@pro-laico/payload-icons/admin/iconRowLabel'

const titleField: TextField = { name: 'title', type: 'text', required: true, unique: true, defaultValue: 'New Icon Set' }

const usageField: UIField = { name: 'iconUsage', type: 'ui', admin: { components: { Field: IconUsagePanelPath } } }

const nameField: TextField = {
  name: 'name',
  type: 'text',
  required: true,
  hooks: { beforeValidate: [kebabCaseName] },
  admin: { width: '25%', description: d.iconRowName, style: { maxWidth: '350px' } },
}

const iconField = (iconSlug: string): UploadField => ({
  name: 'icon',
  type: 'upload',
  relationTo: asSlug(iconSlug),
  displayPreview: false,
  admin: { allowCreate: false, width: '75%', description: 'Select an icon.', style: { maxWidth: '350px' } },
})

const iconsArrayField = (iconSlug: string, iconRowFields: CollectionConfig['fields']): ArrayField => {
  const row: RowField = { type: 'row', fields: [nameField, iconField(iconSlug), ...iconRowFields] }
  return {
    name: 'iconsArray',
    type: 'array',
    label: 'Icons',
    labels: { singular: 'Icon', plural: 'Icons' },
    admin: { initCollapsed: true, components: { RowLabel: IconRowLabelPath } },
    fields: [row],
  }
}

const tabsField = ({ iconSlug, usagePanel, iconRowFields }: IconSetCollectionArgs): TabsField => {
  const settingsRow: RowField = { type: 'row', fields: [activeField, titleField] }
  return {
    type: 'tabs',
    tabs: [
      { label: 'Settings', fields: usagePanel ? [settingsRow, usageField] : [settingsRow] },
      { label: 'Icons', fields: [iconsArrayField(iconSlug, iconRowFields)] },
    ],
  }
}

/** The base `iconSet` collection. `collections.iconSet` is merged onto it by the kit's `mergeCollection`. */
export const createIconSetCollection = (args: IconSetCollectionArgs): CollectionConfig => ({
  slug: ICON_SET_SLUG,
  labels: { singular: 'Icon Set', plural: 'Icon Sets' },
  access: { create: authd, delete: authd, read: authd, update: authd },
  custom: { revalidate: { extraTags: [ICONS_REVALIDATE_TAG] } },
  admin: { group: 'Sets', enableListViewSelectAPI: true, useAsTitle: 'title', defaultColumns: ['title', 'active', '_status'] },
  fields: [tabsField(args)],
  hooks: { beforeChange: [enforceSingleActive] },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 50 },
})

import type { CollectionConfig, TextField, UIField } from 'payload'

import { mergeHooks } from '../lib/mergeHooks'
import { authd } from '../access/authenticated'
import { activeField } from '../lib/activeField'
import type { IconSetCollectionOverrides } from '../types'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'
import { kebabCaseName } from '../hooks/field/kebabCaseName'
import { enforceSingleActive } from '../hooks/collection/enforceSingleActive'

const d = {
  iconRowName: 'The name the frontend looks the icon up by (auto kebab-cased).',
}

export const ICON_SET_SLUG = 'iconSet'

const IconUsagePanelPath = '@pro-laico/payload-icons/admin/iconUsagePanel'

const IconRowLabelPath = '@pro-laico/payload-icons/admin/iconRowLabel'

const titleField = (defaultValue = 'New Icon Set'): TextField => ({ name: 'title', type: 'text', required: true, unique: true, defaultValue })

export const createIconSetCollection = (
  opts: IconSetCollectionOverrides & { iconSlug?: string; usagePanel?: boolean } = {},
): CollectionConfig => {
  const {
    slug = ICON_SET_SLUG,
    iconSlug = 'icon',
    livePreviewUrl,
    group = 'Sets',
    hooks,
    fields: extraFields = [],
    iconRowFields = [],
    usagePanel = true,
    drafts = true,
  } = opts

  const usageField: UIField[] = usagePanel ? [{ name: 'iconUsage', type: 'ui', admin: { components: { Field: IconUsagePanelPath } } }] : []

  return {
    slug,
    labels: { singular: 'Icon Set', plural: 'Icon Sets' },
    access: { create: authd, delete: authd, read: authd, update: authd },
    custom: { revalidate: { extraTags: [ICONS_REVALIDATE_TAG] } },
    admin: {
      group,
      enableListViewSelectAPI: true,
      useAsTitle: 'title',
      defaultColumns: ['title', 'active', '_status'],
      ...(livePreviewUrl && {
        preview: (data, { req }) => livePreviewUrl({ data, req }),
        livePreview: { url: ({ data, req }) => livePreviewUrl({ data, req }) },
      }),
    },
    fields: [
      {
        type: 'tabs',
        tabs: [
          { label: 'Settings', fields: [{ type: 'row', fields: [activeField, titleField('New Icon Set')] }, ...extraFields, ...usageField] },
          {
            label: 'Icons',
            fields: [
              {
                name: 'iconsArray',
                type: 'array',
                label: 'Icons',
                labels: { singular: 'Icon', plural: 'Icons' },
                admin: { initCollapsed: true, components: { RowLabel: IconRowLabelPath } },
                fields: [
                  {
                    type: 'row',
                    fields: [
                      {
                        name: 'name',
                        type: 'text',
                        required: true,
                        hooks: { beforeValidate: [kebabCaseName] },
                        admin: { width: '25%', description: d.iconRowName, style: { maxWidth: '350px' } },
                      },
                      {
                        name: 'icon',
                        type: 'upload',
                        relationTo: iconSlug,
                        displayPreview: false,
                        admin: { allowCreate: false, width: '75%', description: 'Select an icon.', style: { maxWidth: '350px' } },
                      },
                      ...iconRowFields,
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    hooks: mergeHooks({ beforeChange: [enforceSingleActive] }, hooks),
    ...(drafts ? { versions: { drafts: { schedulePublish: true }, maxPerDoc: 50 } } : {}),
  }
}

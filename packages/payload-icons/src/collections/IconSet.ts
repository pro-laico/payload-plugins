import type { CollectionConfig, CollectionSlug, Field, PayloadRequest } from 'payload'

import { enforceSingleActive } from '../hooks/collection/enforceSingleActive'
import { kebabCaseName } from '../hooks/field/kebabCaseName'
import { activeField } from '../lib/activeField'
import { authd } from '../lib/authenticated'
import { mergeHooks } from '../lib/mergeHooks'
import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'

/** The default slug for the icon-set collection. */
export const ICON_SET_SLUG = 'iconSet'

/** Admin import-map path for the IconSet "requested icons" usage panel. */
const IconUsagePanelPath = '@pro-laico/payload-icons/admin/iconUsagePanel'

/** Admin import-map path for the per-row label inside `iconsArray`. */
const IconRowLabelPath = '@pro-laico/payload-icons/admin/iconRowLabel'

/** Inline title field so the collection has no template dependency. */
const titleField = (defaultValue = 'New Icon Set'): Field => ({ name: 'title', type: 'text', required: true, unique: true, defaultValue })

/**
 * Overrides for the `iconSet` collection — a named, ordered `name → icon` mapping
 * into the shared `icon` pool. One set is `active` at a time; the frontend renders
 * it (see {@link enforceSingleActive}).
 */
export interface IconSetCollectionOverrides {
  /** Slug for the icon-set collection. @default 'iconSet' */
  slug?: string
  /**
   * Live-preview URL generator. When provided, wires both `admin.preview`
   * (legacy iframe) and `admin.livePreview.url`. Omitted by default.
   */
  livePreviewUrl?: (args: { data: Record<string, unknown>; req: PayloadRequest }) => string | Promise<string>
  /** Override the `admin.group` sidebar label. @default 'Sets' */
  group?: string
  /** Additional collection hooks. */
  hooks?: CollectionConfig['hooks']
  /** Extra set-level fields appended to the Settings tab, below the title. */
  fields?: Field[]
  /** Extra fields appended to each `iconsArray` row, after the built-in `name` + `icon`. */
  iconRowFields?: Field[]
  /** Enable drafts/versions on the collection (per-set draft → publish). @default true */
  drafts?: boolean
}

/**
 * Builds the `iconSet` collection — a named `name → icon` mapping with a
 * single-active toggle; the frontend renders the active set.
 *
 * `iconSlug` and `usagePanel` are wired by the plugin (from the icon collection's
 * slug and the top-level `usagePanel` option); they aren't part of the public
 * override surface.
 */
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

  // The "Requested icons" panel — a server UI field that scans usage (live in dev,
  // manifest in prod) and diffs it against this set's icons. Config-free: the panel
  // uses its defaults (ICON_USAGE_MANIFEST env for the manifest path in prod).
  const usageField: Field[] = usagePanel ? [{ name: 'iconUsage', type: 'ui', admin: { components: { Field: IconUsagePanelPath } } }] : []

  return {
    slug,
    labels: { singular: 'Icon Set', plural: 'Icon Sets' },
    access: { create: authd, delete: authd, read: authd, update: authd },
    // Data-only marker for @pro-laico/payload-revalidate (no dependency): its hooks bust
    // the shared icons tag on every published set write — activating a set, editing its
    // iconsArray, publishing — matching the tag `getIconSvg` applies.
    custom: { revalidate: { extraTags: [ICONS_REVALIDATE_TAG] } },
    admin: {
      group,
      useAsTitle: 'title',
      defaultColumns: ['title', 'active', '_status'],
      ...(livePreviewUrl && {
        preview: (data, { req }) => livePreviewUrl({ data: data as Record<string, unknown>, req }),
        livePreview: { url: ({ data, req }) => livePreviewUrl({ data: data as Record<string, unknown>, req }) },
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
                        // Normalize to kebab-case so the typed name matches `<Icon name>`.
                        hooks: { beforeValidate: [kebabCaseName] },
                        admin: {
                          width: '25%',
                          description: 'The name the frontend looks the icon up by (auto kebab-cased).',
                          style: { maxWidth: '350px' },
                        },
                      },
                      {
                        name: 'icon',
                        type: 'upload',
                        relationTo: iconSlug as CollectionSlug,
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

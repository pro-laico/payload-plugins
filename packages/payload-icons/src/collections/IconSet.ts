import type { CollectionConfig, CollectionSlug, Field, PayloadRequest } from 'payload'

import { activeField, enforceSingleActive } from '../lib/activeField'
import { authd } from '../lib/authenticated'
import { mergeHooks } from '../lib/mergeHooks'
import { toKebabCase } from '../lib/titleCase'

/** The default slug for the icon-set collection. */
export const ICON_SET_SLUG = 'iconSet'

/** Admin import-map path for the IconSet "requested icons" usage panel. */
const IconUsagePanelPath = '@pro-laico/payload-icons/admin/iconUsagePanel'

/** Admin import-map path for the per-row label inside `iconsArray`. */
const IconRowLabelPath = '@pro-laico/payload-icons/admin/iconRowLabel'

/** Default scan command surfaced in the panel's empty state. */
const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

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
  /**
   * Adds the "Requested icons" panel to the Settings tab — a live diff between
   * the names your repo requests (collected by `payload-icons-scan`) and the
   * names defined in this set, each flagged with its `file:line`. @default false
   */
  usagePanel?: boolean
  /**
   * Path to the usage manifest the panel reads. Falls back to the
   * `ICON_USAGE_MANIFEST` env var, then `icon-usage-manifest.json` under the
   * server's working directory. Only meaningful when {@link usagePanel} is `true`.
   */
  usageManifestPath?: string
  /** Command shown in the panel's empty state. @default 'npx payload-icons-scan' */
  usageScanCommand?: string
  /** Enable drafts/versions on the collection (per-set draft → publish). @default true */
  drafts?: boolean
}

/**
 * Builds the `iconSet` collection. The frontend `<Icon name>` resolves through
 * the set named by the `iconSettings` global's `activeSet`, so swapping that
 * relationship re-skins every icon site-wide — no per-set flag, no invariant.
 *
 * `iconSlug` is wired by the plugin from the icon collection's slug; it isn't
 * part of the public override surface.
 */
export const createIconSetCollection = (opts: IconSetCollectionOverrides & { iconSlug?: string } = {}): CollectionConfig => {
  const {
    slug = ICON_SET_SLUG,
    iconSlug = 'icon',
    livePreviewUrl,
    group = 'Sets',
    hooks,
    fields: extraFields = [],
    iconRowFields = [],
    usagePanel = false,
    usageManifestPath,
    usageScanCommand = DEFAULT_SCAN_COMMAND,
    drafts = true,
  } = opts

  // Opt-in "requested icons" panel — a server UI field that reads the build-time
  // usage manifest and diffs it against this set's icons.
  const usageField: Field[] = usagePanel
    ? [
        {
          name: 'iconUsage',
          type: 'ui',
          admin: {
            components: {
              Field: { path: IconUsagePanelPath, serverProps: { manifestPath: usageManifestPath, scanCommand: usageScanCommand } },
            },
          },
        },
      ]
    : []

  return {
    slug,
    labels: { singular: 'Icon Set', plural: 'Icon Sets' },
    access: { create: authd, delete: authd, read: authd, update: authd },
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
                        hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? toKebabCase(value) : value)] },
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

import type { CollectionConfig, CollectionSlug, Field, PayloadRequest } from 'payload'

import { activeField, enforceSingleActive } from '../lib/activeField'
import { authd } from '../lib/authenticated'
import { mergeHooks } from '../lib/mergeHooks'

/** The default slug for the icon-set collection. */
export const ICON_SET_SLUG = 'iconSet'

/** Admin import-map path for the IconSet "requested icons" usage panel. */
export const IconUsagePanelPath = '@pro-laico/payload-icons/admin/iconUsagePanel'

/** Admin import-map path for the per-row label inside `iconsArray`. */
export const IconRowLabelPath = '@pro-laico/payload-icons/admin/iconRowLabel'

/** Default scan command surfaced in the panel's empty state. */
const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

/** Inline title field so the collection has no template dependency. */
const titleField = (defaultValue = 'New Icon Set'): Field => ({
  name: 'title',
  type: 'text',
  required: true,
  unique: true,
  defaultValue,
})

type Hooks = NonNullable<CollectionConfig['hooks']>

/**
 * Overrides for {@link createIconSetCollection} — the `iconSet` collection that
 * groups icons under a named bucket with a single-active toggle, drafts/versions,
 * and an optional "requested icons" usage panel.
 *
 * Field-injection options land at different locations in the admin UI; pick the
 * one that matches the field's natural shape:
 *
 * - {@link extraSettingsFields} — compact, packed into the title/active row.
 * - {@link fields} — full-width, below the title/active row in Settings.
 * - {@link iconRowFields} — per-icon, inside each `iconsArray` entry.
 */
export interface IconSetCollectionOverrides {
  /** Slug for the icon-set collection. @default 'iconSet' */
  slug?: string
  /** The `icon` collection slug each row's upload points at. @default 'icon' */
  iconSlug?: string
  /**
   * Live-preview URL generator. When provided, wires both `admin.preview`
   * (legacy iframe) and `admin.livePreview.url` (Payload live preview). Omitted
   * by default — this package ships no live-preview wiring of its own.
   */
  livePreviewUrl?: (args: { data: Record<string, unknown>; req: PayloadRequest }) => string | Promise<string>
  /** Extra fields packed INTO the Settings row alongside `title` + `active`. Compact, width-constrained. */
  extraSettingsFields?: Field[]
  /** Override `admin.useAsTitle`. @default 'title' */
  useAsTitle?: string
  /** Override the `admin.group` sidebar label. @default 'Sets' */
  group?: string
  /** Additional hooks merged ADDITIVELY after the built-ins, per phase (user hooks run last). */
  hooks?: CollectionConfig['hooks']
  /** Extra set-level fields appended full-width to the Settings tab, below the title/active row. */
  fields?: Field[]
  /** Extra fields appended to each `iconsArray` row, after the built-in `name` + `icon`. */
  iconRowFields?: Field[]
  /**
   * Adds the "Requested icons" panel to the Settings tab — a live diff between
   * the icon names your repo requests (collected by the build-time
   * `payload-icons-scan` into a usage manifest) and the names defined in this
   * set. Missing names are flagged with their `file:line`. Opt-in.
   *
   * @default false
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
  /**
   * Versions/drafts config for the collection. Pass `false` to disable
   * versioning entirely. @default `{ drafts: { schedulePublish: true }, maxPerDoc: 50 }`
   */
  versions?: CollectionConfig['versions']
}

/**
 * Builds the `iconSet` collection — a named, ordered `name → icon` mapping into
 * the shared `icon` pool, with a single-active toggle and drafts/versions. The
 * frontend `<Icon name>` resolves through whichever set is `active`, so swapping
 * the active set re-skins every icon site-wide.
 *
 * Self-contained: the active toggle is a plain checkbox guarded by
 * {@link enforceSingleActive} (no `@pro-laico/core` dependency). Revalidation is
 * left to the consumer — wire `revalidatePath` / `revalidateTag` via {@link IconSetCollectionOverrides.hooks}.
 *
 * @example
 * ```ts
 * createIconSetCollection({
 *   usagePanel: true,
 *   fields: [{ name: 'description', type: 'textarea' }],
 *   iconRowFields: [{ name: 'aliases', type: 'text', hasMany: true }],
 * })
 * ```
 */
export const createIconSetCollection = (opts: IconSetCollectionOverrides = {}): CollectionConfig => {
  const {
    slug = ICON_SET_SLUG,
    iconSlug = 'icon',
    livePreviewUrl,
    extraSettingsFields = [],
    useAsTitle = 'title',
    group = 'Sets',
    hooks: extraHooks,
    fields: extraFields = [],
    iconRowFields = [],
    usagePanel = false,
    usageManifestPath,
    usageScanCommand = DEFAULT_SCAN_COMMAND,
    versions = { drafts: { schedulePublish: true }, maxPerDoc: 50 },
  } = opts

  // Opt-in "requested icons" panel — a server UI field that reads the build-time
  // usage manifest and diffs it against this set's icons. Appended full-width to
  // the Settings tab, below any user `fields`.
  const usageField: Field[] = usagePanel
    ? [
        {
          name: 'iconUsage',
          type: 'ui',
          admin: {
            components: {
              Field: {
                path: IconUsagePanelPath,
                serverProps: { manifestPath: usageManifestPath, scanCommand: usageScanCommand },
              },
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
      useAsTitle,
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
          {
            label: 'Settings',
            fields: [{ type: 'row', fields: [activeField, titleField('New Icon Set'), ...extraSettingsFields] }, ...extraFields, ...usageField],
          },
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
                        admin: {
                          width: '25%',
                          description: 'The name the frontend looks the icon up by (kebab-case).',
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
    hooks: mergeHooks(
      {
        // afterChange (post-commit), not beforeChange — enforcing the single-active
        // invariant after the write lands avoids a concurrent read re-caching a
        // stale "two actives" state.
        afterChange: [enforceSingleActive] as Hooks['afterChange'],
      },
      extraHooks,
    ),
    ...(versions ? { versions } : {}),
  }
}

/** Default `iconSet` collection. Equivalent to `createIconSetCollection()`. */
export const IconSet: CollectionConfig = createIconSetCollection()

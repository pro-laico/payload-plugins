import type { CollectionConfig, Field, PayloadRequest } from 'payload'

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

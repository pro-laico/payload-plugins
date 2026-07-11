import type { Access, CollectionConfig, Field } from 'payload'

/** Access gates for the Icon collection. Any operation you omit falls back to the plugin's
 *  defaults: public `read` (icons are frontend assets) and logged-in-admin writes. */
export interface IconAccess {
  read?: Access
  create?: Access
  update?: Access
  delete?: Access
}

/** Overrides for the `icon` upload collection — replaces collection-level config (slug, adminGroup,
 *  access, upload) and extends `fields` / `hooks`. Every field is optional. */
export interface IconCollectionOverrides {
  /** Slug for the icon collection. @default 'icon' */
  slug?: string
  /** Admin sidebar group the collection appears under. @default 'Assets' */
  adminGroup?: string
  /** Override per-operation access. Omitted operations keep the defaults (public read,
   *  logged-in-admin writes). */
  access?: IconAccess
  /** Extra fields appended after the built-in `optimized` + `svgString` fields. */
  fields?: Field[]
  /** Additional collection hooks, APPENDED to the built-ins — your `beforeChange` hooks
   *  always see the already-optimized SVG. */
  hooks?: CollectionConfig['hooks']
  /** Extra `upload` config shallow-merged onto the default `{ mimeTypes: ['image/svg+xml'] }`
   *  (e.g. a `staticDir`). */
  upload?: Exclude<CollectionConfig['upload'], boolean>
}

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

/** Minimal shape of a stored icon doc — the upload fields, the optimizer's output, and the
 *  virtual (computed-on-read) `name`. */
export interface IconDoc {
  id: string | number
  filename?: string | null
  /** The optimized, sanitized `<svg>…</svg>` string, inlined by the `<Icon>` component. */
  svgString?: string | null
  /** Human-readable optimization report (e.g. "SVG optimized: 1234 to 567 bytes (54.1% reduction)"). */
  optimized?: string | null
  /** Virtual: the filename without directory or `.svg` extension (`arrow-right`). Computed on read. */
  name?: string | null
}

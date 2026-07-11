/** A family key — `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
export type Family = string

export interface ExportFontsEndpointOptions {
  /** Mount path under the Payload API route. Default `/fonts/export` (→ `/api/fonts/export`). */
  path?: string
  /** Slug of the standalone font-selection global. Default `fontSet`. */
  fontSetGlobalSlug?: string
  /** Slug of the optimized (served) weight-file upload collection. Default `fontOptimized`. */
  fontOptimizedSlug?: string
  /** Family keys to resolve from the `fontSet` global. Default sans/serif/mono/display. */
  families?: Family[]
}

/** The selected typeface for a family: a populated `font` doc or its id. */
export type TypefaceRef = { id?: string | number; title?: string | null } | string | number | null
export type FontSelection = Partial<Record<Family, TypefaceRef | TypefaceRef[]>>

/** A single exported weight file: filename, extension, mime, base64 bytes, and (optional) weight/style.
 *  An upright variable file that also carries italics (ital/slnt axes) exports TWICE — once per
 *  style, same bytes; the italic entry carries `obliqueAngle` when the italics ride a slnt axis. */
export type ExportedFont = {
  filename: string
  extension: string
  mimeType: string | null
  data: string
  weight?: string | null
  style?: string | null
  /** For slnt-based italics: the positive CSS `oblique` angle (deg). */
  obliqueAngle?: number | null
}
/** Per-family debug info: is a typeface selected, how many optimized files it has, and how many of
 *  those couldn't be read from storage — so an empty export can name its cause per family. */
export type ExportFamilyDiagnostics = { selected: boolean; typeface?: string; optimizedFiles: number; readFailures: number }
/** JSON returned by the fonts export endpoint — an array of weight files per family.
 *  `diagnostics` is additive; older servers omit it. */
export type ExportFontsResponse = {
  fonts: Partial<Record<Family, ExportedFont[]>>
  diagnostics?: Partial<Record<Family, ExportFamilyDiagnostics>>
}

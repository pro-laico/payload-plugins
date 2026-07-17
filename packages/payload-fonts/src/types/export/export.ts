export type Family = string

export interface ExportFontsEndpointOptions {
  path: string
  /** `null` when the app opted the `fontSet` global out. */
  fontSetGlobalSlug: string | null
  fontOptimizedSlug: string
  families: Family[]
}

export type FontSelection = Partial<Record<Family, TypefaceRef | TypefaceRef[]>>
export type TypefaceRef = { id?: string | number; title?: string | null } | string | number | null

export type ExportedFont = {
  filename: string
  extension: string
  mimeType: string | null
  data: string
  weight?: string | null
  style?: string | null
  obliqueAngle?: number | null
}
export type ExportFontsResponse = {
  fonts: Partial<Record<Family, ExportedFont[]>>
  diagnostics?: Partial<Record<Family, ExportFamilyDiagnostics>>
}
export type ExportFamilyDiagnostics = { selected: boolean; typeface?: string; optimizedFiles: number; readFailures: number }

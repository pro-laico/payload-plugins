export type FontFamily = string

export interface FontFamilyConfig {
  key: string
  label?: string
  fallback?: string
}

export interface ResolvedFontFamily {
  key: string
  label: string
  fallback: string
}

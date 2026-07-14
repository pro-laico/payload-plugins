import type { FontFamily } from '../families/families'

export type RawFace = ActiveFace & { italCapable?: boolean }

export interface ActiveTypeface {
  family: FontFamily
  id: string | number
  faces: ActiveFace[]
}

export interface ActiveFace {
  filename: string
  weight: string
  style: 'normal' | 'italic'
  obliqueAngle?: number
}

export interface GetActiveFontFacesOptions {
  fontSetSlug?: string
  optimizedSlug?: string
  families?: FontFamily[]
}

export interface BuildFontFaceCssOptions {
  cssVarPrefix?: string
  optimizedSlug?: string
  fallbacks?: Record<string, string>
}

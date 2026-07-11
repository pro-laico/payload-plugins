import type { FontFamily } from '../families/families'

/** One served face. Usually one per `fontOptimized` doc — but an upright variable file whose
 *  axes also cover italics (`italCapable`) expands into a second, italic face over the SAME file. */
export interface ActiveFace {
  filename: string
  /** A single CSS weight ('400') or a variable range ('100 900'). */
  weight: string
  style: 'normal' | 'italic'
  /** For slnt-based italics: the positive CSS `oblique` angle (deg). Absent = a true italic
   *  (explicit file, or an `ital` axis that `font-style: italic` activates). */
  obliqueAngle?: number
}

/** A raw `fontOptimized` doc's face fields, before ital-capability expansion. */
export type RawFace = ActiveFace & { italCapable?: boolean }

/** The typeface active for a family, plus its served faces. */
export interface ActiveTypeface {
  family: FontFamily
  id: string | number
  faces: ActiveFace[]
}

export interface GetActiveFontFacesOptions {
  /** Slug of the standalone font-selection global. @default 'fontSet' */
  fontSetSlug?: string
  /** Slug of the optimized (served) upload collection. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Family keys to read. Omit to auto-discover them from the `fontSet` global's own slots. */
  families?: FontFamily[]
}

export interface BuildFontFaceCssOptions {
  /** Prefix for the emitted CSS family variables; the capitalised family is appended (`--font-setSans`).
   *  Must match the download CLI's `cssVariablePrefix`. @default '--font-set' */
  cssVarPrefix?: string
  /** Slug used to build the served file URL. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Per-family CSS fallback stack override (`{ brand: 'Georgia, serif' }`). Falls back to the
   *  built-in family defaults, then a generic sans stack. */
  fallbacks?: Record<string, string>
}

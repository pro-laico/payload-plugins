/** The slice of fontkit's `Font` we read for weight/style/family detection. */
export type FontkitFont = {
  familyName?: string | null
  subfamilyName?: string | null
  italicAngle?: number
  /** Variation axes by tag (variable fonts only); we read `wght` for the weight range. */
  variationAxes?: Record<string, { min: number; default: number; max: number }> | null
  'OS/2'?: { usWeightClass?: number; fsSelection?: number } | null
}

/** subset-font's default export: subset + convert in one call. */
export type SubsetFontFn = (buffer: Buffer, text: string, options: { targetFormat: 'woff2' | 'woff' | 'sfnt' }) => Promise<Buffer>

/** What {@link detectMetadata} reads out of a font binary. */
export interface FontFileMetadata {
  familyName?: string
  weight?: string
  style?: 'normal' | 'italic'
  isVariable: boolean
  /** The file ALSO carries italics through a variation axis (an `ital` axis reaching 1, or a
   *  negative `slnt` range) while its default instance is upright — one file, both styles. */
  italCapable?: boolean
  /** For `slnt`-based italics: the positive CSS oblique angle (deg) matching the axis extreme. */
  obliqueAngle?: number
}

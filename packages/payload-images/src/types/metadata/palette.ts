/** The extracted color palette: the Vibrant-style swatches and the histogram candidate. */

export interface PaletteSwatch {
  /** The swatch color, `#rrggbb`. */
  background: string
  /** Contrast-safe text color over `background` (`#000000` or `#ffffff`). */
  foreground: string
  /** Suggested title/heading color over `background` (same contrast pick). */
  title: string
  /** Share of sampled pixels this swatch represents, 0–1. */
  population: number
}

/** The seven swatches. Any may be null when the image has no color in that class. */
export interface ImagePalette {
  dominant: PaletteSwatch | null
  vibrant: PaletteSwatch | null
  darkVibrant: PaletteSwatch | null
  lightVibrant: PaletteSwatch | null
  muted: PaletteSwatch | null
  darkMuted: PaletteSwatch | null
  lightMuted: PaletteSwatch | null
}

export interface Candidate {
  r: number
  g: number
  b: number
  count: number
  s: number
  l: number
}

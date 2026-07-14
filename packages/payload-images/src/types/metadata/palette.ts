export interface PaletteSwatch {
  background: string
  foreground: string
  title: string
  population: number
}

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

/**
 * Sanity-style palette extraction — pure math over the same tiny linear-RGB grid the blurhash
 * encoder samples, so it costs no extra decode. Coarse histogram → the seven Vibrant-style
 * swatches, each carrying a contrast-safe text color.
 */
import { type LinearGrid, linearToSrgb } from '../placeholders/codec'

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

interface Candidate {
  r: number
  g: number
  b: number
  count: number
  s: number
  l: number
}

const hex = (n: number): string => n.toString(16).padStart(2, '0')

const saturationLightness = (r: number, g: number, b: number): { s: number; l: number } => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s, l }
}

/** WCAG-ish relative luminance from sRGB ints. */
const luminance = (r: number, g: number, b: number): number => {
  const lin = (v: number): number => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const toSwatch = (c: Candidate, total: number): PaletteSwatch => {
  const text = luminance(c.r, c.g, c.b) > 0.35 ? '#000000' : '#ffffff'
  return {
    background: `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`,
    foreground: text,
    title: text,
    population: Math.round((c.count / total) * 1000) / 1000,
  }
}

const DARK_MAX = 0.32
const LIGHT_MIN = 0.68
const VIBRANT_SAT = 0.35

/** Build the palette from a linear-RGB pixel grid (any size; the blurhash 64px grid is plenty). */
export const buildPalette = (grid: LinearGrid): ImagePalette => {
  const bins = new Map<number, { r: number; g: number; b: number; count: number }>()
  let total = 0
  for (const row of grid)
    for (const p of row) {
      const r = linearToSrgb(p[0])
      const g = linearToSrgb(p[1])
      const b = linearToSrgb(p[2])
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      const bin = bins.get(key)
      if (bin) {
        bin.r += r
        bin.g += g
        bin.b += b
        bin.count++
      } else {
        bins.set(key, { r, g, b, count: 1 })
      }
      total++
    }

  const candidates: Candidate[] = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 64)
    .map((bin) => {
      const r = Math.round(bin.r / bin.count)
      const g = Math.round(bin.g / bin.count)
      const b = Math.round(bin.b / bin.count)
      return { r, g, b, count: bin.count, ...saturationLightness(r, g, b) }
    })

  const pick = (match: (c: Candidate) => boolean): PaletteSwatch | null => {
    const found = candidates.find(match)
    return found ? toSwatch(found, total) : null
  }

  const mid = (c: Candidate): boolean => c.l >= DARK_MAX && c.l <= LIGHT_MIN
  return {
    dominant: candidates.length ? toSwatch(candidates[0]!, total) : null,
    vibrant: pick((c) => c.s >= VIBRANT_SAT && mid(c)),
    darkVibrant: pick((c) => c.s >= VIBRANT_SAT && c.l < DARK_MAX),
    lightVibrant: pick((c) => c.s >= VIBRANT_SAT && c.l > LIGHT_MIN),
    muted: pick((c) => c.s < VIBRANT_SAT && mid(c)),
    darkMuted: pick((c) => c.s < VIBRANT_SAT && c.l < DARK_MAX),
    lightMuted: pick((c) => c.s < VIBRANT_SAT && c.l > LIGHT_MIN),
  }
}

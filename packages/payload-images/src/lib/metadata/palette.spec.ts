import { describe, expect, it } from 'vitest'

import { type LinearGrid, srgbToLinear } from '../placeholders/codec'
import { buildPalette } from './palette'

/** A WxH grid filled by a per-pixel sRGB color function. */
const grid = (w: number, h: number, color: (x: number, y: number) => [number, number, number]): LinearGrid =>
  Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const [r, g, b] = color(x, y)
      return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] as [number, number, number]
    }),
  )

describe('buildPalette', () => {
  it('classifies vibrant / muted / dark / light swatches with contrast-safe text', () => {
    // Left half saturated red (vibrant), right half light grey (lightMuted), bottom strip near-black (darkMuted).
    const p = buildPalette(
      grid(32, 32, (x, y) => {
        if (y > 27) return [12, 12, 14]
        return x < 16 ? [220, 30, 40] : [210, 210, 212]
      }),
    )
    expect(p.vibrant?.background).toMatch(/^#[0-9a-f]{6}$/)
    expect(p.vibrant?.foreground).toBe('#ffffff') // white text on saturated red
    expect(p.lightMuted?.foreground).toBe('#000000') // black text on light grey
    expect(p.darkMuted?.foreground).toBe('#ffffff')
    // Dominant is the most populous color (red and grey tie-ish; population sane).
    expect(p.dominant).not.toBeNull()
    expect(p.dominant!.population).toBeGreaterThan(0.3)
    expect(p.dominant!.population).toBeLessThanOrEqual(1)
  })

  it('a solid image yields a dominant with full population and no opposite-class swatches', () => {
    const p = buildPalette(grid(16, 16, () => [40, 90, 200]))
    expect(p.dominant?.population).toBe(1)
    expect(p.dominant?.background).toBe(p.vibrant?.background ?? p.dominant?.background)
    expect(p.lightMuted).toBeNull()
    expect(p.darkMuted).toBeNull()
  })

  it('an empty grid yields all-null swatches', () => {
    const p = buildPalette([])
    expect(p.dominant).toBeNull()
    expect(p.vibrant).toBeNull()
  })
})

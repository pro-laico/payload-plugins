import { describe, expect, it } from 'vitest'

import { coverCropGeometry, coverObjectPosition, cropRegion, hotspotWindow, hotspotWindowFractions, windowCss } from './geometry'

// `coverObjectPosition` must reproduce `coverCropGeometry` as an object-position %,
// so the admin preview (object-fit: cover) matches the endpoint's crop exactly.
describe('coverObjectPosition', () => {
  // 1000×500 source cropped to a 1:1 box → horizontal crop only.
  it('keeps the focal subject centered across the mid-range (the endpoint behavior, not a proportional pan)', () => {
    // focal 70% would pan to 70% under raw object-position; the endpoint centers it.
    expect(coverObjectPosition(1000, 500, 1, 1, 70, 50).x).toBeCloseTo(90, 0)
    // The non-cropped axis stays centered.
    expect(coverObjectPosition(1000, 500, 1, 1, 70, 50).y).toBe(50)
  })

  it('agrees with raw focal only at the endpoints (0 / 50 / 100%)', () => {
    expect(coverObjectPosition(1000, 500, 1, 1, 0, 50).x).toBeCloseTo(0, 0)
    expect(coverObjectPosition(1000, 500, 1, 1, 50, 50).x).toBeCloseTo(50, 0)
    expect(coverObjectPosition(1000, 500, 1, 1, 100, 50).x).toBeCloseTo(100, 0)
  })

  it('returns the same window the endpoint extracts (object-position ↔ left/overflow)', () => {
    // A 3:2 target from a 16:10 source crops on BOTH axes, so neither overflow is zero.
    const g = coverCropGeometry(1600, 1000, 600, 400, 80, 30)
    const ox = g.resizeWidth - g.width
    const oy = g.resizeHeight - g.height
    const expectedX = ox > 0 ? (g.left / ox) * 100 : 50
    const expectedY = oy > 0 ? (g.top / oy) * 100 : 50
    const pos = coverObjectPosition(1600, 1000, 3, 2, 80, 30)
    expect(pos.x).toBeCloseTo(expectedX, 0)
    expect(pos.y).toBeCloseTo(expectedY, 0)
  })

  it('centers an axis that is not cropped (target aspect matches source)', () => {
    expect(coverObjectPosition(1000, 500, 2, 1, 90, 90)).toEqual({ x: 50, y: 50 })
  })

  it('guards against degenerate inputs', () => {
    expect(coverObjectPosition(0, 0, 1, 1, 70, 70)).toEqual({ x: 50, y: 50 })
  })
})

describe('hotspotWindow (zoom + crop layers)', () => {
  it('focalSize 100 with no crop is the maximal window (identity with plain focal-cover)', () => {
    const win = hotspotWindow(1200, 800, 1.5, { focalX: 50, focalY: 50 })
    expect(win).toEqual({ x: 0, y: 0, w: 1200, h: 800 })
    const wide = hotspotWindow(1200, 800, 3, {})
    expect(wide.w).toBe(1200)
    expect(wide.h).toBe(400)
  })

  it('a smaller hotspot zooms in: the window is the smallest AR-rect containing the circle', () => {
    const win = hotspotWindow(1200, 800, 1.5, { focalX: 50, focalY: 50, focalSize: 50 })
    expect(win.h).toBeCloseTo(400) // circle diameter = 50% of 800
    expect(win.w).toBeCloseTo(600)
    expect(win.x).toBeCloseTo(300) // centered on focal
    expect(win.y).toBeCloseTo(200)
  })

  it('the window clamps to the crop region and the focal clamps inside it', () => {
    const o = { focalX: 0, focalY: 50, focalSize: 50, cropLeft: 25 }
    const win = hotspotWindow(1200, 800, 1.5, o)
    expect(win.x).toBeGreaterThanOrEqual(300) // region starts at 25% of 1200
    const region = cropRegion(1200, 800, o)
    expect(region).toEqual({ x: 300, y: 0, w: 900, h: 800 })
    expect(win.x + win.w).toBeLessThanOrEqual(region.x + region.w + 1e-9)
  })

  it('coverCropGeometry with a hotspot zoom maps the window into resize/extract space', () => {
    // 50% hotspot on 1200x800 at 600x400 output: window = 600x400 → scale 1 → extract at 300,200.
    const g = coverCropGeometry(1200, 800, 600, 400, 50, 50, { focalSize: 50 })
    expect(g).toMatchObject({ resizeWidth: 1200, resizeHeight: 800, left: 300, top: 200, width: 600, height: 400 })
  })

  it('windowCss reproduces the window as tile-relative percentages', () => {
    const css = windowCss(1200, 800, 1.5, { focalSize: 50 })
    expect(css.width).toBeCloseTo(200) // source is 2x the window width
    expect(css.left).toBeCloseTo(-50) // window starts halfway into the doubled image
    expect(css.top).toBeCloseTo(-50)
  })

  it('hotspotWindowFractions matches hotspotWindow (unit-square form)', () => {
    const px = hotspotWindow(1500, 1000, 1, { focalX: 30, focalY: 70, focalSize: 40, cropTop: 10 })
    const fr = hotspotWindowFractions(1.5, 1, { focalX: 30, focalY: 70, focalSize: 40, cropTop: 10 })
    expect(fr.x).toBeCloseTo(px.x / 1500)
    expect(fr.y).toBeCloseTo(px.y / 1000)
    expect(fr.w).toBeCloseTo(px.w / 1500)
    expect(fr.h).toBeCloseTo(px.h / 1000)
  })
})

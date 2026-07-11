import { describe, expect, it } from 'vitest'

import { coverCropGeometry, cropRegion, hotspotWindow, hotspotWindowFractions, windowCss } from './geometry'

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

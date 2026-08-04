import { describe, expect, it } from 'vitest'

import { parsePresetMatches, parsePrewarmStatus, parseVariantAxis } from '../../src/components/admin/presetManager/parsers'

describe('parseVariantAxis', () => {
  it('projects docs onto the width axis, keeping only the tick fields', () => {
    const raw = {
      docs: [{ id: 1, width: 640, height: 360, fit: 'cover', quality: 80, format: 'webp', cacheKey: 'k1', filename: 'dropped.webp' }],
      totalDocs: 1,
    }
    expect(parseVariantAxis(raw)).toEqual({
      docs: [{ width: 640, height: 360, fit: 'cover', quality: 80, format: 'webp', cacheKey: 'k1' }],
      totalDocs: 1,
    })
  })

  it('drops docs without a numeric width — a tick needs a position', () => {
    const raw = { docs: [{ width: 500 }, { width: 'wide' }, null, {}], totalDocs: 4 }
    expect(parseVariantAxis(raw)?.docs).toEqual([
      { width: 500, cacheKey: undefined, height: undefined, fit: undefined, quality: undefined, format: undefined },
    ])
  })

  it('falls back to docs.length when totalDocs is missing, and null on a bad shape', () => {
    expect(parseVariantAxis({ docs: [{ width: 100 }] })?.totalDocs).toBe(1)
    expect(parseVariantAxis({})).toBeNull()
    expect(parseVariantAxis(null)).toBeNull()
  })
})

describe('parsePresetMatches', () => {
  it('retains cacheKey so the tick line can classify preset-backed variants beyond the current page', () => {
    const raw = { presets: [{ name: 'og', variantId: 7, filename: 'og.jpg', cacheKey: 'abc' }, { name: 'thumbnail' }] }
    const out = parsePresetMatches(raw)
    expect(out?.get('og')).toEqual({ variantId: 7, filename: 'og.jpg', cacheKey: 'abc' })
    expect(out?.get('thumbnail')).toEqual({ variantId: undefined })
  })
})

describe('parsePrewarmStatus plan rows', () => {
  it('narrows params onto the PlanRow shape the ticks rely on (w/h/fit/quality + item format)', () => {
    const raw = {
      status: 'queued',
      plan: [
        { cacheKey: 'k1', format: 'webp', params: { w: 640, h: 360, fit: 'cover', q: 80 } },
        { format: 'webp', params: { w: 100 } }, // no cacheKey → dropped
      ],
    }
    expect(parsePrewarmStatus(raw)?.plan).toEqual([{ cacheKey: 'k1', w: 640, h: 360, fit: 'cover', quality: 80, format: 'webp' }])
  })
})

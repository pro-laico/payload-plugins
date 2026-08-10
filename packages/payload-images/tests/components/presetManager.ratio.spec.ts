import { describe, expect, it } from 'vitest'

import { ratioLabel } from '../../src/components/admin/presetManager/ratio'

describe('ratioLabel', () => {
  it('returns undefined without both dimensions', () => {
    expect(ratioLabel(undefined, undefined)).toBeUndefined()
    expect(ratioLabel(800, undefined)).toBeUndefined()
    expect(ratioLabel(undefined, 600)).toBeUndefined()
    expect(ratioLabel(0, 600)).toBeUndefined()
  })

  it('labels exact common ratios', () => {
    expect(ratioLabel(1920, 1080)).toBe('16:9')
    expect(ratioLabel(1024, 768)).toBe('4:3')
    expect(ratioLabel(512, 512)).toBe('1:1')
    expect(ratioLabel(1200, 600)).toBe('2:1')
  })

  it('snaps crops whose rounded pixel counts miss the exact pair', () => {
    expect(ratioLabel(800, 533)).toBe('3:2') // h = round(800 / 1.5)
    expect(ratioLabel(1200, 675)).toBe('16:9')
    expect(ratioLabel(511, 512)).toBe('1:1')
  })

  it('labels portrait orientations with the inverted pair', () => {
    expect(ratioLabel(1080, 1920)).toBe('9:16')
    expect(ratioLabel(533, 800)).toBe('2:3')
  })

  it('falls back to a clean exact reduction, then a decimal', () => {
    expect(ratioLabel(700, 500)).toBe('7:5')
    expect(ratioLabel(1000, 407)).toBe(2.46)
  })
})

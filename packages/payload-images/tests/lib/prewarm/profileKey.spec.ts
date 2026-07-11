import { describe, expect, it } from 'vitest'

import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { canonicalProfileKey, classifyRatio, ratioToken } from '../../../src/lib/prewarm/profileKey'

const constraints = DEFAULT_CONSTRAINTS

describe('canonicalProfileKey / ratioToken', () => {
  it('joins the parts with pipes and rounds ratios to 3 decimals', () => {
    expect(ratioToken(16 / 9)).toBe('1.778')
    expect(ratioToken(1)).toBe('1')
    expect(canonicalProfileKey({ ratio: '1.778', fit: 'cover', quality: 75, format: 'auto' })).toBe('1.778|cover|75|auto')
    expect(canonicalProfileKey({ ratio: 'natural', fit: 'contain', quality: 40, format: 'webp' })).toBe('natural|contain|40|webp')
  })
})

describe('classifyRatio', () => {
  it('classifies a width-only request as none', () => {
    expect(classifyRatio({ w: 640, h: undefined, sourceW: 2400, sourceH: 1600, candidates: [], constraints })).toBe('none')
  })

  it('recognizes the natural ratio at multiple widths by exact replay', () => {
    // 2400×1600 source (ratio 1.5). buildVariantUrl emits h = round(w / 1.5), then the endpoint snaps.
    for (const w of [300, 650, 1600]) {
      const h = Math.round(Math.round(w / 1.5) / 50) * 50 // what parseTransformParams serves
      expect(classifyRatio({ w, h, sourceW: 2400, sourceH: 1600, candidates: [], constraints })).toBe('natural')
    }
  })

  it('matches a declared candidate ratio ahead of the fragment fallback', () => {
    const candidates = [{ token: ratioToken(16 / 9), ratio: 16 / 9 }]
    // 16:9 at w=1600 → h = 900 exactly (multiple of 50, no snap distortion).
    expect(classifyRatio({ w: 1600, h: 900, sourceW: 2400, sourceH: 1600, candidates, constraints })).toBe('1.778')
  })

  it('falls back to a 3-decimal fragment when no candidate replays to the served height', () => {
    // Served pair implies a ~2.0 ratio no candidate declares.
    expect(classifyRatio({ w: 800, h: 400, sourceW: 2400, sourceH: 1600, candidates: [], constraints })).toBe('2')
  })

  it('prefers natural over an equivalent declared candidate (priority order)', () => {
    // Candidate ratio equals the natural ratio — natural wins because it is tried first.
    const candidates = [{ token: ratioToken(1.5), ratio: 1.5 }]
    expect(classifyRatio({ w: 600, h: 400, sourceW: 2400, sourceH: 1600, candidates, constraints })).toBe('natural')
  })
})

import { describe, expect, it } from 'vitest'

import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { FALLBACK_MIN_WIDTH_RATIO, pickFallbackVariant } from '../../../src/lib/transform/fallback'
import type { FallbackCandidate, ParsedParams } from '../../../src/types'

const constraints = DEFAULT_CONSTRAINTS
const source = { width: 2400, height: 1600 } // natural ratio 1.5

const cand = (over: Partial<FallbackCandidate>): FallbackCandidate => ({
  id: 'v1',
  filename: 'v1.webp',
  width: 800,
  height: 450,
  fit: 'cover',
  format: 'webp',
  quality: 75,
  mimeType: 'image/webp',
  ...over,
})

const req = (over: Partial<ParsedParams>): ParsedParams => ({ w: 1600, h: 900, fit: 'cover', q: 75, fmt: 'auto', ...over })

const pick = (
  p: ParsedParams,
  candidates: FallbackCandidate[],
  format: 'webp' | 'avif' | 'jpeg' | 'png' = 'webp',
  src: { width?: number | null; height?: number | null } = source,
) => pickFallbackVariant(p, format, src, candidates, constraints)

describe('pickFallbackVariant — geometry matching (exact replay, no epsilon)', () => {
  it('matches across snap distortion in BOTH directions', () => {
    // Request 650×350 (16:9 snapped at w=650) ← candidate 1600×900 (true 16:9): reverse replay.
    expect(pick(req({ w: 650, h: 350 }), [cand({ width: 1600, height: 900 })])).toBeTruthy()
    // Request 1600×900 ← candidate 850×500 (16:9 snapped at w=850): forward replay (478 → 500).
    expect(pick(req({ w: 1600, h: 900 }), [cand({ width: 850, height: 500 })])).toBeTruthy()
  })

  it('matches off-grid ACTUAL dims via the derived-height rule (width-only + no-upscale clamp)', () => {
    // A width-only variant of a 1200×800 source stored as 800×533 (Sharp-derived height, off-grid).
    const src = { width: 1200, height: 800 }
    expect(pick(req({ w: 1000, h: undefined }), [cand({ width: 800, height: 533 })], 'webp', src)).toBeTruthy()
    // A 1600×900 request clamped by a 1200-wide source → stored 1200×675; matches a fresh 16:9 request.
    expect(pick(req({ w: 1600, h: 900 }), [cand({ width: 1200, height: 675 })], 'webp', src)).toBeTruthy()
  })

  it('disqualifies a different crop: fit mismatch and ratio mismatch', () => {
    expect(pick(req({}), [cand({ fit: 'contain' })])).toBeNull()
    expect(pick(req({ w: 1600, h: 900 }), [cand({ width: 1200, height: 900 })])).toBeNull() // 4:3 vs 16:9
  })

  it('rejects avif candidates unless the request negotiated avif', () => {
    expect(pick(req({}), [cand({ format: 'avif', mimeType: 'image/avif' })], 'webp')).toBeNull()
    expect(pick(req({}), [cand({ format: 'avif', mimeType: 'image/avif', width: 1600, height: 900 })], 'avif')).toBeTruthy()
  })
})

describe('pickFallbackVariant — width policy and ranking', () => {
  it('enforces the width floor (a 50px placeholder never stands in for a hero)', () => {
    expect(pick(req({ w: 1600, h: 900 }), [cand({ width: 700, height: 394 })])).toBeNull() // < 0.5 × 1600
    expect(FALLBACK_MIN_WIDTH_RATIO).toBe(0.5)
  })

  it('clamps the floor anchor to the source width (upscale-clamped requests)', () => {
    // Request 1600 on a 1200-wide source: effective target 1200 → a 700-wide candidate qualifies (700 ≥ 600).
    const src = { width: 1200, height: 800 }
    expect(pick(req({ w: 1600, h: 900 }), [cand({ width: 700, height: 394 })], 'webp', src)).toBeTruthy()
  })

  it('prefers the smallest sufficient width, else the largest below', () => {
    const a = cand({ id: 'a', width: 1800, height: 1013 })
    const b = cand({ id: 'b', width: 1650, height: 928 })
    const c = cand({ id: 'c', width: 1200, height: 675 })
    expect(pick(req({ w: 1600, h: 900 }), [a, b, c])?.id).toBe('b') // smallest ≥ 1600
    expect(pick(req({ w: 1600, h: 900 }), [c, cand({ id: 'd', width: 900, height: 506 })])?.id).toBe('c') // largest below
  })

  it('breaks width ties by quality closeness, then negotiated format', () => {
    const q60 = cand({ id: 'q60', width: 1600, height: 900, quality: 60 })
    const q75 = cand({ id: 'q75', width: 1600, height: 900, quality: 75 })
    expect(pick(req({ q: 75 }), [q60, q75])?.id).toBe('q75')
    const jpeg = cand({ id: 'jpeg', width: 1600, height: 900, format: 'jpeg', mimeType: 'image/jpeg' })
    const webp = cand({ id: 'webp', width: 1600, height: 900, format: 'webp' })
    expect(pick(req({}), [jpeg, webp], 'webp')?.id).toBe('webp')
  })
})

describe('pickFallbackVariant — anchors and null cases', () => {
  it('returns null for height-only requests and for width-only requests on dimensionless sources', () => {
    expect(pick(req({ w: undefined, h: 900 }), [cand({})])).toBeNull()
    expect(pick(req({ w: 800, h: undefined }), [cand({})], 'webp', {})).toBeNull()
  })

  it('anchors width-only requests to the source natural ratio', () => {
    // 1.5 source: a 16:9 candidate must not stand in for a natural-ratio request.
    expect(pick(req({ w: 800, h: undefined }), [cand({ width: 1600, height: 900 })])).toBeNull()
    expect(pick(req({ w: 800, h: undefined }), [cand({ width: 1200, height: 800 })])).toBeTruthy()
  })

  it('ignores candidates with missing dims', () => {
    expect(pick(req({}), [cand({ width: null, height: null })])).toBeNull()
  })
})

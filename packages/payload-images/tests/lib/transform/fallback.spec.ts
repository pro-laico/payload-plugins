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

describe('pickFallbackVariant — crop-family separation (ratio drift gate + ratio-first ranking)', () => {
  // A ?w=400&ar=3:2 request parses to 400×250 (snap), whose band also admits 16:9 and 7:4
  // candidates via geometry replay. The drift gate must reject the wrong families and the
  // correct 3:2 stand-in must win.
  const src = { width: 3000, height: 2000 }
  const c169 = cand({ id: '16:9', width: 800, height: 450 })
  const c74 = cand({ id: '7:4', width: 700, height: 400 })
  const c32 = cand({ id: '3:2', width: 800, height: 533 })

  it('rejects cross-family candidates that land in the snap band (400×250 vs 16:9 / 7:4)', () => {
    expect(pick(req({ w: 400, h: 250 }), [c169], 'webp', src)).toBeNull()
    expect(pick(req({ w: 400, h: 250 }), [c74], 'webp', src)).toBeNull()
  })

  it('picks the correct-family stand-in over band-stragglers', () => {
    expect(pick(req({ w: 400, h: 250 }), [c169, c74, c32], 'webp', src)?.id).toBe('3:2')
  })

  it('mirror case: a 16:9 request never gets the 400×250 (3:2-ish) crop', () => {
    expect(pick(req({ w: 800, h: 450 }), [cand({ width: 400, height: 250 })], 'webp', src)).toBeNull()
  })
})

describe('pickFallbackVariant — render-path (windowed) matching under a zoomed hotspot', () => {
  // focalSize < 100 makes windowed (w+h cover) and full-frame (width-only) renders DIFFERENT
  // content at identical dims — the persisted render path must match the request's.
  const zoomedSrc = { width: 1600, height: 900, focalSize: 50 }

  it('rejects a full-frame variant standing in for a windowed request (and vice versa)', () => {
    const fullFrame = cand({ width: 800, height: 450, windowed: false })
    const windowed = cand({ id: 'win', width: 800, height: 450, windowed: true })
    expect(pick(req({ w: 800, h: 450 }), [fullFrame], 'webp', zoomedSrc)).toBeNull()
    expect(pick(req({ w: 800, h: 450 }), [windowed], 'webp', zoomedSrc)?.id).toBe('win')
    expect(pick(req({ w: 800, h: undefined }), [windowed], 'webp', zoomedSrc)).toBeNull()
    expect(pick(req({ w: 800, h: undefined }), [fullFrame], 'webp', zoomedSrc)).toBeTruthy()
  })

  it('rejects legacy rows (unknown render path) only when the hotspot actually zooms', () => {
    const legacy = cand({ width: 800, height: 450, windowed: null })
    expect(pick(req({ w: 800, h: 450 }), [legacy], 'webp', zoomedSrc)).toBeNull()
    // focalSize 100/unset: both paths render identically — legacy rows keep matching.
    expect(pick(req({ w: 800, h: 450 }), [legacy], 'webp', { width: 1600, height: 900 })).toBeTruthy()
  })
})

describe('pickFallbackVariant — format support gate', () => {
  it('never serves webp to a client that only negotiated jpeg/png', () => {
    const webp = cand({ width: 1600, height: 900 })
    expect(pick(req({}), [webp], 'jpeg')).toBeNull()
    const jpeg = cand({ width: 1600, height: 900, format: 'jpeg', mimeType: 'image/jpeg' })
    expect(pick(req({}), [jpeg], 'jpeg')).toBeTruthy()
  })

  it('prefers a png candidate for a png request over an equal-width lossy one (stored png quality is meaningless)', () => {
    const png = cand({ id: 'png', width: 1200, height: 800, format: 'png', mimeType: 'image/png', quality: 40 })
    const jpeg = cand({ id: 'jpeg', width: 1200, height: 800, format: 'jpeg', mimeType: 'image/jpeg', quality: 90 })
    const src = { width: 2400, height: 1600 }
    expect(pick(req({ w: 800, h: undefined, q: 90 }), [png, jpeg], 'png', src)?.id).toBe('png')
  })
})

describe('pickFallbackVariant — achievable-width floor (hotspot/crop clamp)', () => {
  it('accepts a stand-in at ~the max achievable render width of a cropped source', () => {
    // cropLeft/Right 25 → window 2000×1333: a 3900×2600 request can never render wider than 2000,
    // so a 1900-wide variant is ≥ half the achievable width even though it is < half of 3900.
    const src = { width: 4000, height: 3000, cropLeft: 25, cropRight: 25 }
    expect(pick(req({ w: 3900, h: 2600 }), [cand({ width: 1900, height: 1250 })], 'webp', src)).toBeTruthy()
  })
})

describe('pickFallbackVariant — focal-mismatch rejection (stale-crop guard)', () => {
  it('rejects a candidate whose baked focal differs from the source current focal', () => {
    // Source now at focal (70,60); a variant persisted with the old (30,40) is a stale crop.
    const src = { ...source, focalX: 70, focalY: 60 }
    const stale = cand({ width: 1600, height: 900, focalX: 30, focalY: 40 })
    const fresh = cand({ id: 'fresh', width: 1600, height: 900, focalX: 70, focalY: 60 })
    expect(pickFallbackVariant(req({ w: 1600, h: 900 }), 'webp', src, [stale], constraints)).toBeNull()
    expect(pickFallbackVariant(req({ w: 1600, h: 900 }), 'webp', src, [fresh], constraints)?.id).toBe('fresh')
  })

  it('tolerates ≤1pp focal rounding (saliency 96.9 stored as 97) but rejects a real edit', () => {
    const src = { ...source, focalX: 96.9, focalY: 52.8 }
    const rounded = cand({ width: 1600, height: 900, focalX: 97, focalY: 53 })
    const edited = cand({ id: 'edited', width: 1600, height: 900, focalX: 80, focalY: 53 })
    expect(pickFallbackVariant(req({ w: 1600, h: 900 }), 'webp', src, [rounded], constraints)).toBeTruthy()
    expect(pickFallbackVariant(req({ w: 1600, h: 900 }), 'webp', src, [edited], constraints)).toBeNull()
  })

  it('treats null focal on either side as the 50/50 default (no false rejection for legacy rows)', () => {
    // Source default focal (null → 50/50); a variant stored with null focal must still match.
    const legacy = cand({ width: 1600, height: 900, focalX: null, focalY: null })
    expect(pick(req({ w: 1600, h: 900 }), [legacy])).toBeTruthy()
  })
})

import { describe, expect, it } from 'vitest'

import { variantCacheKey } from '../../../src/lib/transform/variantKey'
import { DEFAULT_CONSTRAINTS, parseTransformParams } from '../../../src/lib/transform/params'
import { computePrewarmTargets, DEFAULT_PREWARM_WIDTHS } from '../../../src/lib/prewarm/computeTargets'
import type { ComputeTargetsArgs, OutputFormat, QuerySource, RenderProfileDoc } from '../../../src/types'

const now = new Date('2026-07-11T00:00:00Z')
const source = { id: 'img1', filename: 'a.jpg', width: 2400, height: 1600, focalX: 50, focalY: 50 }

const profile = (over: Partial<RenderProfileDoc>): RenderProfileDoc => ({
  id: 'p1',
  profileKey: '1.778|cover|80|auto',
  ratio: '1.778',
  fit: 'cover',
  quality: 80,
  format: 'auto',
  hitCount: 10,
  lastSeenAt: now.toISOString(),
  widths: null,
  ...over,
})

const compute = (over: Partial<ComputeTargetsArgs> = {}) =>
  computePrewarmTargets({
    source,
    profiles: [],
    seeds: [],
    formats: ['webp'],
    constraints: DEFAULT_CONSTRAINTS,
    existingKeys: new Set(),
    maxVariantsPerImage: 24,
    now,
    ...over,
  })

const organicKey = (query: QuerySource, format: OutputFormat): string => {
  const parsed = parseTransformParams(query, DEFAULT_CONSTRAINTS)
  if (!parsed.ok) throw new Error(parsed.error)
  return variantCacheKey(source, parsed.params, format)
}

describe('computePrewarmTargets', () => {
  it('always emits the built-ins first, surviving any budget', () => {
    const targets = compute({ maxVariantsPerImage: 3 })
    expect(targets).toHaveLength(3)
    // src default (≤1280 at the natural ratio), thumbnail (160² cover), placeholder (w32 → snapped, q40)
    expect(targets[0]?.key).toBe(organicKey({ w: '1280', ar: String(2400 / 1600), fit: 'cover', q: '75' }, 'webp'))
    expect(targets[1]?.key).toBe(organicKey({ w: '160', ar: '1', fit: 'cover', q: '75' }, 'webp'))
    expect(targets[2]?.key).toBe(organicKey({ w: '32', ar: String(2400 / 1600), fit: 'cover', q: '40' }, 'webp'))
  })

  it('round-trips: every emitted key equals variantCacheKey of its own params + format', () => {
    const targets = compute({ profiles: [profile({})] })
    for (const t of targets) expect(variantCacheKey(source, t.params, t.format)).toBe(t.key)
  })

  it('warms observed profiles at their top observed widths, ranked by count', () => {
    const p = profile({ widths: { '640': { n: 9, last: now.toISOString() }, '1600': { n: 3, last: now.toISOString() } } })
    const keys = compute({ profiles: [p] }).map((t) => t.key)
    expect(keys).toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    expect(keys).toContain(organicKey({ w: '1600', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
  })

  it('falls back to the default ladder when a profile has no width observations', () => {
    const keys = compute({ profiles: [profile({})] }).map((t) => t.key)
    for (const w of DEFAULT_PREWARM_WIDTHS) {
      expect(keys).toContain(organicKey({ w: String(w), ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    }
  })

  it('drops profiles older than the TTL window (seeds are pinned)', () => {
    const stale = profile({ quality: 60, lastSeenAt: new Date(now.getTime() - 40 * 86_400_000).toISOString() })
    const keys = compute({ profiles: [stale], seeds: [{ aspectRatio: '4:3', quality: 60 }] }).map((t) => t.key)
    expect(keys).not.toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '60' }, 'webp'))
    expect(keys).toContain(organicKey({ w: '640', ar: String(4 / 3), fit: 'cover', q: '60' }, 'webp'))
  })

  it('clamps observed widths to the source width (never upscales)', () => {
    const p = profile({ widths: { '3000': { n: 5, last: now.toISOString() } } })
    const clamped = compute({ profiles: [p] }).find((t) => t.params.w === 2400)
    expect(clamped?.key).toBe(organicKey({ w: '2400', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
  })

  it('expands auto profiles across configured formats, but honors a concrete observed format', () => {
    const auto = profile({ widths: { '640': { n: 5, last: now.toISOString() } } })
    const jpeg = profile({
      id: 'p2',
      profileKey: '1.778|cover|50|jpeg',
      quality: 50,
      format: 'jpeg',
      widths: { '640': { n: 5, last: now.toISOString() } },
    })
    const targets = compute({ profiles: [auto, jpeg], formats: ['webp', 'avif'] })
    // 640 snaps to the endpoint's 50px grid → 650 (the replay applies the same snap organic traffic gets).
    const q80 = targets.filter((t) => t.params.q === 80 && t.params.w === 650)
    const q50 = targets.filter((t) => t.params.q === 50 && t.params.w === 650)
    expect(q80.map((t) => t.format).sort()).toEqual(['avif', 'webp'])
    expect(q50.map((t) => t.format)).toEqual(['jpeg'])
  })

  it('subtracts already-generated variants and respects the overall cap', () => {
    const existing = new Set([organicKey({ w: '160', ar: '1', fit: 'cover', q: '75' }, 'webp')])
    const targets = compute({ profiles: [profile({})], existingKeys: existing, maxVariantsPerImage: 5 })
    expect(targets).toHaveLength(5)
    expect(targets.map((t) => t.key)).not.toContain([...existing][0])
  })

  it('ranks busier profiles first when the budget cuts off the tail', () => {
    const busy = profile({ id: 'busy', quality: 80, hitCount: 100, widths: { '640': { n: 50, last: now.toISOString() } } })
    const quiet = profile({
      id: 'quiet',
      profileKey: '1.778|cover|50|auto',
      quality: 50,
      hitCount: 1,
      widths: { '640': { n: 1, last: now.toISOString() } },
    })
    // Budget: 3 built-ins + 1 slot — the busy profile's width must win it.
    const keys = compute({ profiles: [quiet, busy], maxVariantsPerImage: 4 }).map((t) => t.key)
    expect(keys).toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    expect(keys).not.toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '50' }, 'webp'))
  })
})

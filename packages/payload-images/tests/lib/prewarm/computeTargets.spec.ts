import { describe, expect, it } from 'vitest'

import { stepWidths } from '../../../src/lib/urls/srcset'
import { variantCacheKey } from '../../../src/lib/transform/variantKey'
import { computePrewarmTargets } from '../../../src/lib/prewarm/computeTargets'
import { deriveStrategyWidths } from '../../../src/lib/prewarm/deriveWidths'
import { DEFAULT_CONSTRAINTS, DEFAULT_WIDTH_LADDER, parseTransformParams } from '../../../src/lib/transform/params'
import type {
  ComputeTargetsArgs,
  OutputFormat,
  QuerySource,
  RenderProfileDoc,
  ResolvedPrewarmStrategy,
  TransformConstraints,
} from '../../../src/types'

const now = new Date('2026-07-11T00:00:00Z')
const source = { id: 'img1', filename: 'a.jpg', width: 2400, height: 1600, focalX: 50, focalY: 50 }
// Array-pixelStep constraints: an explicit ladder folded in as `widthLadder` (the conventional
// rung setup), so the 'srcset' width axis stays small and exact.
const constraints: TransformConstraints = { ...DEFAULT_CONSTRAINTS, widthLadder: DEFAULT_WIDTH_LADDER }
const ladderWidths = stepWidths(source.width, DEFAULT_WIDTH_LADDER, constraints.maxDimension)

const strategy = (over: Partial<ResolvedPrewarmStrategy> = {}): ResolvedPrewarmStrategy => ({
  widths: 'srcset',
  builtIns: true,
  learned: true,
  seeds: [{ aspectRatio: '1:1', quality: 80 }],
  onUpload: true,
  autoRun: false,
  autoRunLimit: 50,
  queue: 'default',
  ...over,
})

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
    strategy: strategy(),
    formats: ['webp'],
    constraints,
    existingKeys: new Set(),
    maxVariantsPerImage: 32,
    now,
    ...over,
  })

const organicKey = (query: QuerySource, format: OutputFormat): string => {
  const parsed = parseTransformParams(query, constraints)
  if (!parsed.ok) throw new Error(parsed.error)
  return variantCacheKey(source, parsed.params, format)
}

describe('computePrewarmTargets', () => {
  it('always emits the built-ins first, surviving any budget', () => {
    const { targets, truncated } = compute({ maxVariantsPerImage: 3 })
    expect(targets).toHaveLength(3)
    expect(truncated).toBe(true)
    // src default (≤1280, NO ratio — `src` URLs carry no `h` when the read declares no ratio),
    // thumbnail (160² cover), placeholder (w32 → snapped, q40 at the natural ratio)
    expect(targets[0]?.key).toBe(organicKey({ w: '1280', fit: 'cover', q: '90' }, 'webp'))
    expect(targets[1]?.key).toBe(organicKey({ w: '160', ar: '1', fit: 'cover', q: '90' }, 'webp'))
    expect(targets[2]?.key).toBe(organicKey({ w: '32', ar: String(2400 / 1600), fit: 'cover', q: '40' }, 'webp'))
  })

  it('round-trips: every emitted key equals variantCacheKey of its own params + format', () => {
    const { targets } = compute({ profiles: [profile({})] })
    for (const t of targets) expect(variantCacheKey(source, t.params, t.format)).toBe(t.key)
  })

  it('warms the default 1:1 q80 seed across the strategy widths, so a fresh image serves declared crops warm', () => {
    const keys = compute().targets.map((t) => t.key)
    for (const w of ladderWidths) {
      expect(keys).toContain(organicKey({ w: String(w), ar: '1', fit: 'cover', q: '80' }, 'webp'))
    }
    expect(compute().truncated).toBe(false)
  })

  it('warms observed profiles at their top observed widths, ranked by count', () => {
    const p = profile({ widths: { '640': { n: 9, last: now.toISOString() }, '1600': { n: 3, last: now.toISOString() } } })
    const keys = compute({ profiles: [p] }).targets.map((t) => t.key)
    expect(keys).toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    expect(keys).toContain(organicKey({ w: '1600', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
  })

  it("falls back to the strategy's ladder widths when a profile has no width observations", () => {
    const keys = compute({ profiles: [profile({})] }).targets.map((t) => t.key)
    for (const w of ladderWidths) {
      expect(keys).toContain(organicKey({ w: String(w), ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    }
  })

  it('drops profiles older than the TTL window (seeds are pinned)', () => {
    const stale = profile({ quality: 60, lastSeenAt: new Date(now.getTime() - 40 * 86_400_000).toISOString() })
    const withSeed = strategy({ seeds: [{ aspectRatio: '4:3', quality: 60 }] })
    const keys = compute({ profiles: [stale], strategy: withSeed }).targets.map((t) => t.key)
    expect(keys).not.toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '60' }, 'webp'))
    expect(keys).toContain(organicKey({ w: '640', ar: String(4 / 3), fit: 'cover', q: '60' }, 'webp'))
  })

  it('clamps observed widths to the source width (never upscales)', () => {
    const p = profile({ widths: { '3000': { n: 5, last: now.toISOString() } } })
    const keys = compute({ profiles: [p] }).targets.map((t) => t.key)
    expect(keys).toContain(organicKey({ w: '2400', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    expect(keys).not.toContain(organicKey({ w: '3000', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
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
    const { targets } = compute({ profiles: [auto, jpeg], formats: ['webp', 'avif'] })
    // 640 is a ladder rung, so the endpoint's snap keeps it exact; h pins the 16:9 profile renders
    // (360 snaps to the 50px grid's 350 — the default 1:1 seed warms the same width at h=640).
    const q80 = targets.filter((t) => t.params.q === 80 && t.params.w === 640 && t.params.h === 350)
    const q50 = targets.filter((t) => t.params.q === 50 && t.params.w === 640)
    expect(q80.map((t) => t.format).sort()).toEqual(['avif', 'webp'])
    expect(q50.map((t) => t.format)).toEqual(['jpeg'])
  })

  it('subtracts already-generated variants and respects the overall cap', () => {
    const existing = new Set([organicKey({ w: '160', ar: '1', fit: 'cover', q: '90' }, 'webp')])
    const { targets, truncated } = compute({ profiles: [profile({})], existingKeys: existing, maxVariantsPerImage: 5 })
    expect(targets).toHaveLength(5)
    expect(truncated).toBe(true)
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
    // Budget: 3 built-ins + 1 slot (no seeds) — the busy profile's width must win it.
    const keys = compute({ profiles: [quiet, busy], strategy: strategy({ seeds: [] }), maxVariantsPerImage: 4 }).targets.map((t) => t.key)
    expect(keys).toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '80' }, 'webp'))
    expect(keys).not.toContain(organicKey({ w: '640', ar: '1.778', fit: 'cover', q: '50' }, 'webp'))
  })

  it('builtIns: false and learned: false leave only the default seed at the strategy widths', () => {
    const bare = strategy({ builtIns: false, learned: false })
    const { targets } = compute({ profiles: [profile({})], strategy: bare })
    expect(targets.map((t) => t.params.w)).toEqual(ladderWidths)
    for (const t of targets) expect(t.params.q).toBe(80)
  })

  it('warms explicit strategy widths through the endpoint snap', () => {
    const explicit = strategy({ widths: [300, 900], builtIns: false, learned: false })
    const keys = compute({ strategy: explicit }).targets.map((t) => t.key)
    expect(keys).toEqual([
      organicKey({ w: '300', ar: '1', fit: 'cover', q: '80' }, 'webp'),
      organicKey({ w: '900', ar: '1', fit: 'cover', q: '80' }, 'webp'),
    ])
  })

  it('spreads a unit evenly across its range when the cap cannot fit it, instead of cutting the tail', () => {
    // Default seed alone: 8 srcset widths into a 4-slot budget → an even spread keeping both extremes.
    const bare = strategy({ builtIns: false, learned: false })
    const { targets, truncated } = compute({ strategy: bare, maxVariantsPerImage: 4 })
    expect(truncated).toBe(true)
    expect(targets).toHaveLength(4)
    const widths = targets.map((t) => t.params.w)
    expect(widths[0]).toBe(ladderWidths[0]) // the smallest survives
    expect(widths.at(-1)).toBe(2400) // and the top rung survives — the tail is not cut
  })

  it('widths: { every: 2 } samples the reachable width space, always keeping the top rung', () => {
    const sampled = strategy({ widths: { every: 2 }, builtIns: false, learned: false })
    const expected = deriveStrategyWidths({ every: 2 }, source.width, constraints)
    const widths = compute({ strategy: sampled }).targets.map((t) => t.params.w)
    expect(widths).toEqual(expected)
    expect(widths).toContain(2400)
    expect(widths).not.toContain(2350)
  })
})

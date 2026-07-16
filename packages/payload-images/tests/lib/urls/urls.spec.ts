import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// buildVariantUrl / deriveVersion / stepWidths are internal helpers behind the two published
// builders — tested here directly from their modules.
import { buildSrcset, getImageUrl } from '../../../src/lib/urls/index'
import { buildVariantUrl } from '../../../src/lib/urls/variantUrl'
import { deriveVersion } from '../../../src/lib/urls/version'
import { stepWidths } from '../../../src/lib/urls/srcset'

describe('buildVariantUrl', () => {
  it('bakes settings into a same-origin query URL', () => {
    expect(buildVariantUrl('abc', 640, { fit: 'cover', quality: 80, format: 'webp', aspectRatio: '16:9' })).toBe(
      '/api/img/abc?w=640&h=360&fit=cover&q=80&fmt=webp',
    )
  })
  it('omits height without an aspect ratio and applies defaults', () => {
    expect(buildVariantUrl('abc', 800)).toBe('/api/img/abc?w=800&fit=cover&q=90&fmt=auto')
  })
  it('supports an absolute base and a custom path', () => {
    expect(buildVariantUrl('abc', 320, { baseUrl: 'https://site.com', path: '/api/image' })).toBe(
      'https://site.com/api/image/abc?w=320&fit=cover&q=90&fmt=auto',
    )
  })
  it('encodes the id', () => {
    expect(buildVariantUrl('a/b', 320)).toContain('/api/img/a%2Fb?')
  })
  it('accepts numeric ids (Postgres serials) like every other entry point', () => {
    expect(buildVariantUrl(42, 320)).toBe('/api/img/42?w=320&fit=cover&q=90&fmt=auto')
  })
  it('clamps a derived height to 1 for extreme aspect ratios (h=0 would 400)', () => {
    expect(buildVariantUrl('abc', 32, { aspectRatio: '4000:30' })).toContain('h=1')
  })
  it('appends a version cache-buster as a trailing v= when given, and omits it otherwise', () => {
    expect(buildVariantUrl('abc', 800, { version: 'xyz9' })).toBe('/api/img/abc?w=800&fit=cover&q=90&fmt=auto&v=xyz9')
    expect(buildVariantUrl('abc', 800)).not.toContain('v=')
  })
  it('short-circuits to ?preset=name, ignoring the width + shape options', () => {
    expect(buildVariantUrl('abc', 800, { preset: 'og', width: 1200, fit: 'contain', quality: 40 } as never)).toBe('/api/img/abc?preset=og')
    expect(buildVariantUrl('abc', 800, { preset: 'og', version: 'v1' })).toBe('/api/img/abc?preset=og&v=v1')
  })
})

describe('deriveVersion', () => {
  it('returns undefined without source identity (a bare id → no v)', () => {
    expect(deriveVersion(undefined)).toBeUndefined()
    expect(deriveVersion({})).toBeUndefined()
  })
  it('is stable for the same filename + focal', () => {
    expect(deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 })).toBe(deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 }))
  })
  it('changes when the file is replaced or the focal point moves', () => {
    const base = deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 })
    expect(deriveVersion({ filename: 'b.png', focalX: 50, focalY: 50 })).not.toBe(base) // file replaced
    expect(deriveVersion({ filename: 'a.png', focalX: 80, focalY: 50 })).not.toBe(base) // focal moved
  })
  it('changes on a same-filename byte replacement (filesize)', () => {
    const base = deriveVersion({ filename: 'a.png', filesize: 1000, focalX: 50, focalY: 50 })
    expect(deriveVersion({ filename: 'a.png', filesize: 2000, focalX: 50, focalY: 50 })).not.toBe(base)
  })
})

describe('stepWidths', () => {
  it('steps by pixelStep up to the source width (the 100px example)', () => {
    expect(stepWidths(100, 50)).toEqual([50, 100])
  })
  it('tops out at the exact source width, not the largest step multiple below it', () => {
    expect(stepWidths(120, 50)).toEqual([50, 100, 120]) // 120 itself caps it (no upscale past native)
  })
  it('emits every pixelStep multiple up to the source — a bigger step means fewer widths', () => {
    expect(stepWidths(600, 200)).toEqual([200, 400, 600])
  })
  it('falls back to stepping up to maxWidth when no source width is given', () => {
    const w = stepWidths(undefined, 50, 200)
    expect(w[w.length - 1]).toBe(200)
    expect(w.every((x: number) => x % 50 === 0)).toBe(true)
  })

  it('defaults to the conventional breakpoint ladder, not a dense 50px grid', () => {
    expect(stepWidths(1200)).toEqual([640, 750, 828, 1080, 1200])
    expect(stepWidths(4096)).toEqual([640, 750, 828, 1080, 1200, 1920, 2048, 3840, 4096])
  })

  describe('explicit width ladder (array pixelStep)', () => {
    it('keeps the ladder widths below the source, then tops out at the exact source width', () => {
      expect(stepWidths(1000, [200, 450, 750, 1200, 2000])).toEqual([200, 450, 750, 1000])
    })
    it('sorts, dedupes, and drops non-positive / over-max values', () => {
      expect(stepWidths(900, [750, 200, 200, -5, 450])).toEqual([200, 450, 750, 900])
      expect(stepWidths(5000, [200, 9999], 4096)).toEqual([200, 4096]) // 9999 > maxWidth, source clamps to 4096
    })
    it('uses the ladder as-is (keeping its author-chosen cap) when no source width is given', () => {
      expect(stepWidths(undefined, [200, 450, 750])).toEqual([200, 450, 750])
    })
    it('collapses to a single source-width candidate when every ladder width exceeds the source', () => {
      expect(stepWidths(160, [200, 450])).toEqual([160])
    })
  })
})

describe('getImageUrl', () => {
  // baseUrl defaults to NEXT_PUBLIC_SERVER_URL; pin it empty so the relative-URL cases are deterministic.
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ''))
  afterEach(() => vi.unstubAllEnvs())

  it('returns null for an empty resource', () => {
    expect(getImageUrl(null)).toBeNull()
    expect(getImageUrl(undefined)).toBeNull()
    expect(getImageUrl('')).toBeNull()
  })
  it('builds a URL from a bare id with a default width', () => {
    expect(getImageUrl('abc')).toBe('/api/img/abc?w=1280&fit=cover&q=90&fmt=auto')
  })
  it('uses an explicit width over the doc/default', () => {
    expect(getImageUrl('abc', { width: 600, aspectRatio: '1:1' })).toBe('/api/img/abc?w=600&h=600&fit=cover&q=90&fmt=auto')
  })
  it('auto-derives the version from a populated doc and falls back to its width', () => {
    const url = getImageUrl({ id: 'abc', width: 900, filename: 'a.png', focalX: 50, focalY: 50 })
    const v = deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 })
    expect(url).toBe(`/api/img/abc?w=900&fit=cover&q=90&fmt=auto&v=${v}`)
  })
  it('defaults baseUrl to NEXT_PUBLIC_SERVER_URL (absolute), overridable with an explicit baseUrl or ""', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://site.com')
    expect(getImageUrl('abc')).toBe('https://site.com/api/img/abc?w=1280&fit=cover&q=90&fmt=auto')
    expect(getImageUrl('abc', { baseUrl: '' })).toBe('/api/img/abc?w=1280&fit=cover&q=90&fmt=auto') // opt out → relative
    expect(getImageUrl('abc', { baseUrl: 'https://cdn.example.com' })).toMatch(/^https:\/\/cdn\.example\.com\/api\/img\//)
  })
})

describe('buildSrcset', () => {
  it('returns null for an empty resource', () => {
    expect(buildSrcset(null)).toBeNull()
    expect(buildSrcset(undefined)).toBeNull()
  })
  it('builds a srcset from a populated doc, capped at its intrinsic width, with a default src', () => {
    const result = buildSrcset({ id: 'abc', width: 100 }, { aspectRatio: '1:1', pixelStep: 50 })
    expect(result?.srcset).toBe('/api/img/abc?w=50&h=50&fit=cover&q=90&fmt=auto 50w, /api/img/abc?w=100&h=100&fit=cover&q=90&fmt=auto 100w')
    expect(result?.src).toBe('/api/img/abc?w=100&h=100&fit=cover&q=90&fmt=auto')
  })
  it('auto-derives the version token from a populated doc and appends it to every URL', () => {
    const v = deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 })
    const result = buildSrcset({ id: 'abc', width: 100, filename: 'a.png', focalX: 50, focalY: 50 }, { pixelStep: 50 })
    for (const entry of (result?.srcset ?? '').split(', ')) expect(entry).toContain(`v=${v}`)
    expect(result?.src).toContain(`v=${v}`)
  })
  it('accepts a bare id (no width cap, no version) and threads a custom endpoint path into every URL', () => {
    const result = buildSrcset('abc', { pixelStep: 50, maxWidth: 100, path: '/api/image' })
    expect(result?.src.startsWith('/api/image/abc?')).toBe(true)
    for (const entry of (result?.srcset ?? '').split(', ')) expect(entry.startsWith('/api/image/abc?')).toBe(true)
  })
})

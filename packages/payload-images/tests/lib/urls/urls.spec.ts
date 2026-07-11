import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildSrcset, buildVariantUrl, deriveVersion, getImageUrl, stepWidths } from '../../../src/lib/urls/index'

describe('buildVariantUrl', () => {
  it('bakes settings into a same-origin query URL', () => {
    expect(buildVariantUrl('abc', 640, { fit: 'cover', quality: 80, format: 'webp', aspectRatio: '16:9' })).toBe(
      '/api/img/abc?w=640&h=360&fit=cover&q=80&fmt=webp',
    )
  })
  it('omits height without an aspect ratio and applies defaults', () => {
    expect(buildVariantUrl('abc', 800)).toBe('/api/img/abc?w=800&fit=cover&q=75&fmt=auto')
  })
  it('supports an absolute base and a custom path', () => {
    expect(buildVariantUrl('abc', 320, { baseUrl: 'https://site.com', path: '/api/image' })).toBe(
      'https://site.com/api/image/abc?w=320&fit=cover&q=75&fmt=auto',
    )
  })
  it('encodes the id', () => {
    expect(buildVariantUrl('a/b', 320)).toContain('/api/img/a%2Fb?')
  })
  it('appends a version cache-buster as a trailing v= when given, and omits it otherwise', () => {
    expect(buildVariantUrl('abc', 800, { version: 'xyz9' })).toBe('/api/img/abc?w=800&fit=cover&q=75&fmt=auto&v=xyz9')
    expect(buildVariantUrl('abc', 800)).not.toContain('v=')
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
    expect(w.every((x) => x % 50 === 0)).toBe(true)
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
    expect(getImageUrl('abc')).toBe('/api/img/abc?w=1280&fit=cover&q=75&fmt=auto')
  })
  it('uses an explicit width over the doc/default', () => {
    expect(getImageUrl('abc', { width: 600, aspectRatio: '1:1' })).toBe('/api/img/abc?w=600&h=600&fit=cover&q=75&fmt=auto')
  })
  it('auto-derives the version from a populated doc and falls back to its width', () => {
    const url = getImageUrl({ id: 'abc', width: 900, filename: 'a.png', focalX: 50, focalY: 50 })
    const v = deriveVersion({ filename: 'a.png', focalX: 50, focalY: 50 })
    expect(url).toBe(`/api/img/abc?w=900&fit=cover&q=75&fmt=auto&v=${v}`)
  })
  it('defaults baseUrl to NEXT_PUBLIC_SERVER_URL (absolute), overridable with an explicit baseUrl or ""', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://site.com')
    expect(getImageUrl('abc')).toBe('https://site.com/api/img/abc?w=1280&fit=cover&q=75&fmt=auto')
    expect(getImageUrl('abc', { baseUrl: '' })).toBe('/api/img/abc?w=1280&fit=cover&q=75&fmt=auto') // opt out → relative
    expect(getImageUrl('abc', { baseUrl: 'https://cdn.example.com' })).toMatch(/^https:\/\/cdn\.example\.com\/api\/img\//)
  })
})

describe('buildSrcset', () => {
  it('builds a srcset capped at the source width with a default src', () => {
    const { srcset, src } = buildSrcset('abc', { aspectRatio: '1:1', sourceWidth: 100, pixelStep: 50 })
    expect(srcset).toBe('/api/img/abc?w=50&h=50&fit=cover&q=75&fmt=auto 50w, /api/img/abc?w=100&h=100&fit=cover&q=75&fmt=auto 100w')
    expect(src).toBe('/api/img/abc?w=100&h=100&fit=cover&q=75&fmt=auto')
  })
  it('threads a custom endpoint path into every generated URL', () => {
    const { srcset, src } = buildSrcset('abc', { sourceWidth: 100, pixelStep: 50, path: '/api/image' })
    expect(src.startsWith('/api/image/abc?')).toBe(true)
    for (const entry of srcset.split(', ')) expect(entry.startsWith('/api/image/abc?')).toBe(true)
  })
})

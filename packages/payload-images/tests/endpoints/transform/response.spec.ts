import { describe, expect, it } from 'vitest'

import { buildFallbackHeaders, buildHeaders } from '../../../src/endpoints/transform/response'

describe('buildHeaders (exact variant)', () => {
  it('is immutable + ETagged, with CDN headers for public responses', () => {
    const h = buildHeaders('image/webp', 'abc123', true, true, true)
    expect(h['Cache-Control']).toContain('immutable')
    expect(h.ETag).toBe('"abc123"')
    expect(h['CDN-Cache-Control']).toContain('immutable')
    expect(h.Vary).toBe('Accept')
    expect(buildHeaders('image/webp', 'abc123', false, true, false)['CDN-Cache-Control']).toBeUndefined()
  })
})

describe('buildFallbackHeaders (nearby stand-in)', () => {
  it('is no-store everywhere and carries NO ETag — nothing may cache the stand-in', () => {
    const h = buildFallbackHeaders('image/webp', true, true)
    expect(h['Cache-Control']).toBe('no-store')
    expect(h['CDN-Cache-Control']).toBe('no-store')
    expect(h['Vercel-CDN-Cache-Control']).toBe('no-store')
    expect(h.ETag).toBeUndefined()
    expect(h.Vary).toBe('Accept')
    expect(h['Content-Type']).toBe('image/webp')
  })

  it('omits CDN headers when cdn is off, and Vary when the format was explicit', () => {
    const h = buildFallbackHeaders('image/jpeg', false, false)
    expect(h['Cache-Control']).toBe('no-store')
    expect(h['CDN-Cache-Control']).toBeUndefined()
    expect(h.Vary).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { asset, ref, video } from '../refs'
import { sourceKey } from './sources'
import { collectTokens, docNodeId, resolveTokens } from './tokens'

describe('collectTokens', () => {
  it('finds refs and assets nested in objects and arrays', () => {
    const data = {
      image: asset('hero'),
      related: [ref('services', 'a'), { nested: ref('services', 'b') }],
      title: 'plain',
    }
    const tokens = collectTokens(data)
    expect(tokens).toHaveLength(3)
    expect(tokens.filter((t) => t.__seedRef === 'doc')).toHaveLength(2)
    expect(tokens.filter((t) => t.__seedRef === 'asset')).toHaveLength(1)
  })

  it('returns nothing for token-free data', () => {
    expect(collectTokens({ a: 1, b: ['x', { c: true }] })).toEqual([])
  })
})

describe('resolveTokens', () => {
  const ctx = {
    docs: new Map<string, string | number>([[docNodeId('services', 'a'), 42]]),
    assets: new Map<string, string | number>([['hero', 7]]),
    sources: new Map<string, string>([[sourceKey('video', 'intro.mp4'), '/abs/seed-assets/videos/intro.mp4']]),
    where: 'test',
  }

  it('replaces tokens with resolved ids, preserving structure', () => {
    const out = resolveTokens({ image: asset('hero'), rel: ref('services', 'a'), keep: 'x', arr: [ref('services', 'a')] }, ctx)
    expect(out).toEqual({ image: 7, rel: 42, keep: 'x', arr: [42] })
  })

  it('resolves a source token to { file, ...options }', () => {
    const out = resolveTokens({ source: video('intro.mp4', { playbackPolicy: 'public' }) }, ctx)
    expect(out).toEqual({ source: { file: '/abs/seed-assets/videos/intro.mp4', playbackPolicy: 'public' } })
  })

  it('throws a contextual error for an unresolved ref', () => {
    expect(() => resolveTokens({ r: ref('services', 'missing') }, ctx)).toThrow(/unresolved ref\('services', 'missing'\)/)
  })

  it('throws a contextual error for an unresolved asset', () => {
    expect(() => resolveTokens({ a: asset('nope') }, ctx)).toThrow(/unresolved asset\('nope'\)/)
  })
})

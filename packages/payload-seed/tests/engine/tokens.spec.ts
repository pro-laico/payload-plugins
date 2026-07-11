import { describe, expect, it } from 'vitest'
import { file, ref } from '../../src/refs'
import { collectTokens, docNodeId, resolveTokens } from '../../src/engine/tokens'

describe('collectTokens', () => {
  it('finds ref tokens nested in objects and arrays (files are not edge tokens)', () => {
    const data = {
      related: [ref('services', 'a'), { nested: ref('services', 'b') }],
      _file: file('hero.jpg'),
      title: 'plain',
    }
    const tokens = collectTokens(data)
    expect(tokens).toHaveLength(2)
    expect(tokens.every((t) => t.__seedRef === 'doc')).toBe(true)
  })

  it('returns nothing for token-free data', () => {
    expect(collectTokens({ a: 1, b: ['x', { c: true }] })).toEqual([])
  })
})

describe('resolveTokens', () => {
  const ctx = { docs: new Map<string, string | number>([[docNodeId('services', 'a'), 42]]), where: 'test' }

  it('replaces ref tokens with resolved ids, preserving structure', () => {
    const out = resolveTokens({ rel: ref('services', 'a'), keep: 'x', arr: [ref('services', 'a')] }, ctx)
    expect(out).toEqual({ rel: 42, keep: 'x', arr: [42] })
  })

  it('passes file tokens through untouched (they are delivered separately)', () => {
    const token = file('intro.mp4', { weight: '400' })
    expect(resolveTokens({ _file: token }, ctx)).toEqual({ _file: token })
  })

  it('throws a contextual error for an unresolved ref', () => {
    expect(() => resolveTokens({ r: ref('services', 'missing') }, ctx)).toThrow(/unresolved ref\('services', 'missing'\)/)
  })
})

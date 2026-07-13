import { describe, expect, it } from 'vitest'
import { createTags, riskyAliasReason } from '../../src/lib/tags'

describe('createTags', () => {
  const tags = createTags()

  it('builds list, doc, global, and all tags', () => {
    expect(tags.list('posts')).toBe('posts')
    expect(tags.doc('posts', 42)).toBe('posts:42')
    expect(tags.doc('posts', 'my-slug')).toBe('posts:my-slug')
    expect(tags.global('header')).toBe('global:header')
    expect(tags.all()).toBe('all')
  })

  it('builds draft-lane variants', () => {
    expect(tags.list('posts', { draft: true })).toBe('posts:draft')
    expect(tags.doc('posts', 42, { draft: true })).toBe('posts:42:draft')
    expect(tags.global('header', { draft: true })).toBe('global:header:draft')
  })

  it('builds scoped list tags', () => {
    expect(tags.list('posts', { scope: 'recent' })).toBe('posts:list:recent')
    expect(tags.list('posts', { scope: 'recent', draft: true })).toBe('posts:list:recent:draft')
  })

  it('binds the given prefix into every builder', () => {
    const prefixed = createTags('shop')
    expect(prefixed.list('posts')).toBe('shop:posts')
    expect(prefixed.doc('posts', 42, { draft: true })).toBe('shop:posts:42:draft')
    expect(prefixed.global('header')).toBe('shop:global:header')
    expect(prefixed.all()).toBe('shop:all')
  })

  it('two builder sets are independent — no shared state', () => {
    const a = createTags('a')
    const b = createTags()
    expect(a.all()).toBe('a:all')
    expect(b.all()).toBe('all')
  })
})

describe('riskyAliasReason', () => {
  it('flags the reserved draft suffix, embedded colons, and all-digit slugs', () => {
    expect(riskyAliasReason('draft')).toMatch(/draft/)
    expect(riskyAliasReason('list:recent')).toMatch(/':'/)
    expect(riskyAliasReason('2024')).toMatch(/digit/)
  })

  it('passes normal slugs and exempts numbers (a numeric id is skipped upstream)', () => {
    expect(riskyAliasReason('my-post')).toBeNull()
    expect(riskyAliasReason('draft-mode')).toBeNull()
    expect(riskyAliasReason(42)).toBeNull()
  })
})

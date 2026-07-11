import { afterEach, describe, expect, it } from 'vitest'
import { getState, riskyAliasReason, stashState, tags } from '../src/tags'

const reset = () => stashState({ prefix: '', observe: false })

describe('tags', () => {
  afterEach(reset)

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

  it('applies the stashed prefix to every builder', () => {
    stashState({ prefix: 'shop', observe: false })
    expect(tags.list('posts')).toBe('shop:posts')
    expect(tags.doc('posts', 42, { draft: true })).toBe('shop:posts:42:draft')
    expect(tags.global('header')).toBe('shop:global:header')
    expect(tags.all()).toBe('shop:all')
  })

  it('defaults to no prefix when nothing was stashed', () => {
    expect(getState().prefix).toBe('')
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

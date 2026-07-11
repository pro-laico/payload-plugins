import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../../src/observe/registry'
import { stashState } from '../../src/tags'
import type { SeedResultLike } from '../../src/types'
import { registerSeedListener, seedBusts } from '../../src/seed/afterSeed'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }))

describe('seedBusts', () => {
  it('busts list tags (bare + declared scopes, both lanes) per touched slug, extraTags, global tags, and all', () => {
    stashState({ prefix: '', observe: false, lists: { posts: ['recent'] }, extraTags: { posts: ['sitemap'], icon: ['payload-icons'] } })
    const result: SeedResultLike = { created: { posts: 3 }, collections: ['posts', 'faqs'], globals: ['header'] }
    expect(
      seedBusts(result)
        .map((b) => b.tag)
        .sort(),
    ).toEqual(
      [
        'posts',
        'posts:draft',
        'posts:list:recent',
        'posts:list:recent:draft',
        'sitemap',
        'faqs',
        'faqs:draft',
        'global:header',
        'global:header:draft',
        'all',
      ].sort(),
    )
  })

  it("busts a touched collection's extraTags — entries tagged ONLY through one carry no `all`", () => {
    stashState({ prefix: '', observe: false, extraTags: { icon: ['payload-icons'], iconSet: ['payload-icons'] } })
    const busts = seedBusts({ created: { icon: 2 }, collections: ['icon', 'iconSet'] })
    expect(busts.filter((b) => b.tag === 'payload-icons')).toEqual([
      { tag: 'payload-icons', reason: 'extra' },
      { tag: 'payload-icons', reason: 'extra' }, // deduped downstream in bust()
    ])
  })

  it("busts a touched collection's rule targets — same rationale as extraTags (no `all` on rule-tagged entries)", () => {
    stashState({
      prefix: '',
      observe: false,
      rules: [
        { on: 'faqs', bust: ['services-html'], whenFields: ['question'] },
        { on: 'untouched', bust: ['elsewhere'] },
      ],
    })
    const tags = seedBusts({ created: { faqs: 5 } }).map((b) => b.tag)
    expect(tags).toContain('services-html')
    expect(tags).not.toContain('elsewhere')
  })

  it('returns nothing for an empty run', () => {
    stashState({ prefix: '', observe: false })
    expect(seedBusts({ created: {} })).toEqual([])
  })
})

describe('registerSeedListener', () => {
  beforeEach(() => {
    stashState({ prefix: '', observe: true })
    resetObservations()
    revalidateTag.mockReset()
  })

  it('registers a keyed listener on the shared symbol slot that busts and records', async () => {
    registerSeedListener()
    registerSeedListener() // idempotent — keyed record, HMR-safe
    const listeners = (globalThis as Record<symbol, unknown>)[Symbol.for('pro-laico.payload-seed.afterSeed')] as Record<
      string,
      (result: SeedResultLike) => Promise<void>
    >
    expect(Object.keys(listeners)).toEqual(['pro-laico/payload-revalidate'])

    await listeners['pro-laico/payload-revalidate']?.({ created: { posts: 2 } })
    expect(revalidateTag).toHaveBeenCalledWith('posts')
    expect(getObservations().events[0]).toMatchObject({ source: 'seed', trigger: { operation: 'seed' } })
  })
})

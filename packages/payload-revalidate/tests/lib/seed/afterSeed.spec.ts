import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../../../src/lib/observe/registry'
import { createTags } from '../../../src/lib/tags'
import type { SeedFlushState, SeedResultLike } from '../../../src/types'
import { registerSeedListener, seedBusts } from '../../../src/lib/seed/afterSeed'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }))

const state = (overrides: Partial<SeedFlushState> = {}): SeedFlushState => ({
  tags: createTags(),
  lists: {},
  extraTags: {},
  rules: [],
  observe: false,
  ...overrides,
})

describe('seedBusts', () => {
  it('busts list tags (bare + declared scopes, both lanes) per touched slug, extraTags, global tags, and all', () => {
    const flush = state({ lists: { posts: ['recent'] }, extraTags: { posts: ['sitemap'], icon: ['payload-icons'] } })
    const result: SeedResultLike = { created: { posts: 3 }, collections: ['posts', 'faqs'], globals: ['header'] }
    expect(
      seedBusts(flush, result)
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
    const flush = state({ extraTags: { icon: ['payload-icons'], iconSet: ['payload-icons'] } })
    const busts = seedBusts(flush, { created: { icon: 2 }, collections: ['icon', 'iconSet'] })
    expect(busts.filter((b) => b.tag === 'payload-icons')).toEqual([
      { tag: 'payload-icons', reason: 'extra' },
      { tag: 'payload-icons', reason: 'extra' }, // deduped downstream in bust()
    ])
  })

  it("busts a touched collection's rule targets — same rationale as extraTags (no `all` on rule-tagged entries)", () => {
    const flush = state({
      rules: [
        { on: 'faqs', bust: ['services-html'], whenFields: ['question'] },
        { on: 'untouched', bust: ['elsewhere'] },
      ],
    })
    const tags = seedBusts(flush, { created: { faqs: 5 } }).map((b) => b.tag)
    expect(tags).toContain('services-html')
    expect(tags).not.toContain('elsewhere')
  })

  it('honors the state prefix in every built tag', () => {
    const flush = state({ tags: createTags('shop') })
    const tags = seedBusts(flush, { created: { posts: 1 } }).map((b) => b.tag)
    expect(tags).toContain('shop:posts')
    expect(tags).toContain('shop:all')
  })

  it('returns nothing for an empty run', () => {
    expect(seedBusts(state(), { created: {} })).toEqual([])
  })
})

describe('registerSeedListener', () => {
  beforeEach(() => {
    resetObservations()
    revalidateTag.mockReset()
  })

  it('registers a keyed listener on the shared symbol slot that busts and records', async () => {
    registerSeedListener(state({ observe: true }))
    registerSeedListener(state({ observe: true })) // idempotent — keyed record, HMR-safe
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

import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../../src/lib/observe/registry'
import { createCacheHelpers } from '../../src/cache/index'
import type { PayloadRevalidateMarker } from '../../src/types'

const cacheTag = vi.fn()
const revalidateTag = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheTag: (...args: unknown[]) => cacheTag(...args),
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}))

const marker: PayloadRevalidateMarker = {
  options: {},
  endpointPath: null,
  prefix: '',
  observe: true,
  lists: { posts: ['recent'] },
  extraTags: {},
  rules: [],
}

const schema = {
  collections: [
    {
      slug: 'posts',
      fields: [
        { name: 'slug', type: 'text' },
        { name: 'hero', type: 'upload', relationTo: 'media' },
      ],
    },
    { slug: 'media', fields: [] },
  ],
  globals: [{ slug: 'header', fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }] }],
}

/** A Payload-shaped stub handle — the helpers only touch `.config`. */
const handleWith = (config: Record<string, unknown>): Payload => ({ config }) as unknown as Payload

const handle = handleWith({ ...schema, custom: { payloadRevalidate: marker } })
const { cacheDoc, cacheGlobal, cacheIds, revalidateAll, revalidateDoc, revalidateList } = createCacheHelpers(handle)

const applied = (): string[] => cacheTag.mock.calls.flat() as string[]

describe('cache helpers (atomic, bound to a handle)', () => {
  beforeEach(() => {
    resetObservations()
    cacheTag.mockReset()
    revalidateTag.mockReset()
  })

  it('cacheDoc tags all + doc id + alias; raw-id references do NOT tag', async () => {
    const doc = { id: 1, slug: 'hello', hero: 9 }
    await expect(cacheDoc(doc, 'posts', { as: 'hello' })).resolves.toBe(doc)
    expect(applied().sort()).toEqual(['all', 'posts:1', 'posts:hello'].sort())
  })

  it('cacheDoc tags baked-in populated docs and records them as refactor candidates', async () => {
    await cacheDoc({ id: 1, hero: { id: 9 } }, 'posts')
    expect(applied()).toContain('media:9')
    const read = getObservations().reads[0]
    expect(read?.bakedIn).toEqual([{ tag: 'media:9', via: 'hero', kind: 'upload' }])
  })

  it('cacheDoc(null) tags the alias (cached miss) or falls back to the bare list tag', async () => {
    await cacheDoc(null, 'posts', { as: 'missing' })
    expect(applied().sort()).toEqual(['all', 'posts:missing'].sort())
    cacheTag.mockReset()
    await cacheDoc(null, 'posts')
    expect(applied().sort()).toEqual(['all', 'posts'].sort())
  })

  it('cacheIds tags membership only — all + the list tag, never per-doc tags', async () => {
    await cacheIds({ docs: [{ id: 1 }, { id: 2 }], totalDocs: 2 }, 'posts')
    expect(applied().sort()).toEqual(['all', 'posts'].sort())
  })

  it('cacheIds with a declared scope carries the scoped tag', async () => {
    await cacheIds([1, 2, 3], 'posts', { list: 'recent' })
    expect(applied().sort()).toEqual(['all', 'posts:list:recent'].sort())
    expect(getObservations().reads[0]).toMatchObject({ kind: 'ids', list: 'recent' })
    expect(getObservations().reads[0]?.undeclared).toBeUndefined()
  })

  it('cacheIds flags an undeclared scope', async () => {
    await cacheIds([1], 'posts', { list: 'mystery' })
    expect(applied()).toContain('posts:list:mystery')
    expect(getObservations().reads[0]).toMatchObject({ list: 'mystery', undeclared: true })
  })

  it('honors the marker prefix in every tag', async () => {
    const prefixed = createCacheHelpers(handleWith({ ...schema, custom: { payloadRevalidate: { ...marker, prefix: 'shop' } } }))
    await prefixed.cacheDoc({ id: 1 }, 'posts')
    expect(applied().sort()).toEqual(['shop:all', 'shop:posts:1'].sort())
  })

  it('enforces Next’s 128-tag limit deterministically — statics survive, the read is flagged capped', async () => {
    const wide = createCacheHelpers(
      handleWith({
        collections: [
          { slug: 'posts', fields: [{ name: 'gallery', type: 'array', fields: [{ name: 'img', type: 'upload', relationTo: 'media' }] }] },
          { slug: 'media', fields: [] },
        ],
        globals: [],
        custom: { payloadRevalidate: marker },
      }),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      // 70 baked-in docs under a raised walk cap; the draft read doubles every dep tag:
      // 140 deps + 3 statics > 128. Our slice keeps statics (inserted first) and flags it.
      const doc = { id: 1, gallery: Array.from({ length: 70 }, (_, i) => ({ img: { id: i + 1 } })) }
      await wide.cacheDoc(doc, 'posts', { draft: true, walk: { maxTags: 100 } })
      const tags = applied()
      expect(tags).toHaveLength(128)
      expect(tags).toContain('all')
      expect(tags).toContain('posts:1')
      expect(tags).toContain('posts:1:draft')
      expect(getObservations().reads[0]?.capped).toBe(true)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('128'), expect.anything())
    } finally {
      error.mockRestore()
    }
  })

  it('cacheGlobal tags global + baked-in docs', async () => {
    await cacheGlobal({ logo: { id: 4 } }, 'header')
    expect(applied().sort()).toEqual(['all', 'global:header', 'media:4'].sort())
  })

  it('adds draft variants (except on all) for draft reads', async () => {
    await cacheDoc({ id: 1 }, 'posts', { draft: true })
    expect(applied().sort()).toEqual(['all', 'posts:1', 'posts:1:draft'].sort())
    cacheTag.mockReset()
    await cacheIds([1], 'posts', { list: 'recent', draft: true })
    expect(applied().sort()).toEqual(['all', 'posts:list:recent', 'posts:list:recent:draft'].sort())
  })

  it('honors walk: false and extra tags', async () => {
    await cacheDoc({ id: 1, hero: { id: 9 } }, 'posts', { walk: false, tags: ['sitemap'] })
    expect(applied()).not.toContain('media:9')
    expect(applied()).toContain('sitemap')
  })

  it('manual bust helpers: doc both lanes; list = bare + declared scopes; all', async () => {
    await revalidateDoc('posts', 1)
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(['posts:1', 'posts:1:draft'].sort())
    revalidateTag.mockReset()
    await revalidateList('posts')
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(
      ['posts', 'posts:draft', 'posts:list:recent', 'posts:list:recent:draft'].sort(),
    )
    revalidateTag.mockReset()
    await revalidateAll()
    expect(revalidateTag).toHaveBeenCalledWith('all')
  })

  it('accepts the handle as a promise — only each read awaits it', async () => {
    const lazy = createCacheHelpers(Promise.resolve(handle))
    await lazy.cacheDoc({ id: 7 }, 'posts')
    expect(applied()).toContain('posts:7')
  })
})

describe('marker absent (plugin not applied to the handle’s config)', () => {
  beforeEach(() => {
    resetObservations()
    cacheTag.mockReset()
  })

  it('degrades: doc returned, unprefixed static tags applied, scope status unknowable, one every-env alert naming the fix', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const bare = createCacheHelpers(handleWith({ ...schema, custom: {} }))
      const doc = { id: 1 }
      await expect(bare.cacheDoc(doc, 'posts')).resolves.toBe(doc)
      expect(applied()).toContain('posts:1')
      await bare.cacheIds([1], 'posts', { list: 'mystery' })
      // No marker → declaration status unknowable, not "undeclared".
      expect(getObservations().reads.find((r) => r.kind === 'ids')?.undeclared).toBeUndefined()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('revalidatePlugin()'), expect.anything())
    } finally {
      error.mockRestore()
    }
  })
})

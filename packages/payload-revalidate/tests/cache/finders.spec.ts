import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../../src/lib/observe/registry'
import { createCacheHelpers } from '../../src/cache/index'
import type { PayloadRevalidateMarker } from '../../src/types'

const cacheTag = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheTag: (...args: unknown[]) => cacheTag(...args),
  revalidateTag: vi.fn(),
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

const find = vi.fn()
const findByID = vi.fn()
const findGlobal = vi.fn()
const handle = { config: { ...schema, custom: { payloadRevalidate: marker } }, find, findByID, findGlobal } as unknown as Payload

const helpers = createCacheHelpers(handle)
const applied = (): string[] => cacheTag.mock.calls.flat() as string[]
const paginated = (docs: unknown[]) => ({ docs, page: 1, totalDocs: docs.length, totalPages: 1, hasNextPage: false, hasPrevPage: true })

describe('cached finders (fetch + tag in one call)', () => {
  beforeEach(() => {
    resetObservations()
    cacheTag.mockReset()
    find.mockReset().mockResolvedValue(paginated([]))
    findByID.mockReset().mockResolvedValue(null)
    findGlobal.mockReset().mockResolvedValue({ logo: 4 })
  })

  it('findDoc: forces limit 1 + pagination off, defaults depth 0, leaves access to Payload, tags all + id + alias', async () => {
    const doc = { id: 1, slug: 'hello', hero: 9 }
    find.mockResolvedValue(paginated([doc]))
    const res = await helpers.findDoc('posts', { where: { slug: { equals: 'hello' } }, as: 'hello' })
    expect(res).toBe(doc)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        depth: 0,
        limit: 1,
        pagination: false,
        where: { slug: { equals: 'hello' } },
      }),
    )
    expect(applied().sort()).toEqual(['all', 'posts:1', 'posts:hello'].sort())
  })

  // Forcing `overrideAccess: false` read as an anonymous visitor, so an access-gated collection
  // came back null with no error. The finders leave it alone: Payload's own default applies.
  it('findDoc: never sets overrideAccess itself', async () => {
    find.mockResolvedValue(paginated([{ id: 1 }]))
    await helpers.findDoc('posts')
    expect(find.mock.calls[0]?.[0]).not.toHaveProperty('overrideAccess')
  })

  it('findDoc: overrideAccess false is still honoured when asked for explicitly', async () => {
    find.mockResolvedValue(paginated([{ id: 1 }]))
    await helpers.findDoc('posts', { overrideAccess: false })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: false }))
  })

  it('findDoc miss: returns null, alias still tags the cached miss', async () => {
    await expect(helpers.findDoc('posts', { as: 'missing' })).resolves.toBeNull()
    expect(applied().sort()).toEqual(['all', 'posts:missing'].sort())
  })

  it('findDoc: depth/overrideAccess/select/context/sort pass through', async () => {
    await helpers.findDoc('posts', { depth: 2, overrideAccess: true, select: { slug: true }, context: { render: true }, sort: '-createdAt' })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ context: { render: true }, depth: 2, overrideAccess: true, select: { slug: true }, sort: '-createdAt' }),
    )
  })

  it('findDoc: cache-side options never leak into the payload query', async () => {
    await helpers.findDoc('posts', { as: 'x', label: 'y', tags: ['sitemap'], walk: false })
    const call = find.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(call)).not.toEqual(expect.arrayContaining(['as', 'label', 'tags', 'walk']))
    expect(applied()).toContain('sitemap')
  })

  it('findDocByID: disables errors, defaults depth 0, leaves access to Payload, tags the id', async () => {
    findByID.mockResolvedValue({ id: 7 })
    await expect(helpers.findDocByID('posts', 7)).resolves.toEqual({ id: 7 })
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', depth: 0, disableErrors: true, id: 7 }))
    expect(applied().sort()).toEqual(['all', 'posts:7'].sort())
  })

  it('findIds: forces select {} + depth 0, tags membership, returns ids + pagination meta', async () => {
    find.mockResolvedValue({ docs: [{ id: 1 }, { id: 2 }], page: 2, totalDocs: 12, totalPages: 3, hasNextPage: true, hasPrevPage: true })
    const res = await helpers.findIds('posts', { list: 'recent', sort: '-createdAt', limit: 5, page: 2 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'posts', depth: 0, limit: 5, page: 2, select: {}, sort: '-createdAt' }),
    )
    expect(res).toEqual({ ids: [1, 2], page: 2, totalDocs: 12, totalPages: 3, hasNextPage: true, hasPrevPage: true })
    expect(applied().sort()).toEqual(['all', 'posts:list:recent'].sort())
    expect(getObservations().reads[0]).toMatchObject({ kind: 'ids', list: 'recent' })
  })

  it('findGlobal: defaults depth 0, leaves access to Payload, tags global + baked-in docs', async () => {
    findGlobal.mockResolvedValue({ logo: { id: 4 } })
    await expect(helpers.findGlobal('header')).resolves.toEqual({ logo: { id: 4 } })
    expect(findGlobal).toHaveBeenCalledWith(expect.objectContaining({ slug: 'header', depth: 0 }))
    expect(applied().sort()).toEqual(['all', 'global:header', 'media:4'].sort())
  })

  it('one draft flag drives both the fetch and the tag variants', async () => {
    find.mockResolvedValue(paginated([{ id: 1 }]))
    await helpers.findDoc('posts', { draft: true })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ draft: true }))
    expect(applied().sort()).toEqual(['all', 'posts:1', 'posts:1:draft'].sort())
    cacheTag.mockReset()
    await helpers.findIds('posts', { list: 'recent', draft: true })
    expect(applied().sort()).toEqual(['all', 'posts:list:recent', 'posts:list:recent:draft'].sort())
  })

  it('throws on user/req — a shared cache entry must not hold a requester-scoped read', async () => {
    const scoped = { user: { id: 'u1' } } as never
    await expect(helpers.findDoc('posts', scoped)).rejects.toThrow(/user.*req|req.*user/i)
    await expect(helpers.findDocByID('posts', 1, { req: {} } as never)).rejects.toThrow(/shared across requesters/)
    await expect(helpers.findIds('posts', scoped)).rejects.toThrow(/payload-revalidate/)
    await expect(helpers.findGlobal('header', scoped)).rejects.toThrow(/outside the cache boundary/)
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
    expect(findGlobal).not.toHaveBeenCalled()
  })
})

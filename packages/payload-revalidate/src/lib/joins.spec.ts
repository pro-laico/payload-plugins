import type { Field, Where } from 'payload'
import { describe, expect, it } from 'vitest'
import { collectJoinMembership, extractOnValues, whereFields } from './joins'

describe('whereFields', () => {
  it('collects filtered field paths, recursing and/or combinators', () => {
    expect(whereFields(undefined)).toEqual([])
    expect(whereFields({ status: { equals: 'published' } })).toEqual(['status'])
    const complex: Where = {
      and: [{ status: { equals: 'published' } }, { or: [{ featured: { equals: true } }, { 'meta.pinned': { equals: true } }] }],
    }
    expect(whereFields(complex).sort()).toEqual(['featured', 'meta.pinned', 'status'])
  })
})

describe('collectJoinMembership', () => {
  it('indexes joins by the CHILD collection with their on field', () => {
    const authors: { slug: string; fields: Field[] } = {
      slug: 'authors',
      fields: [{ name: 'posts', type: 'join', collection: 'posts', on: 'author' }],
    }
    const index = collectJoinMembership([authors])
    expect(index.posts).toEqual([{ on: 'author', determinants: [] }])
  })

  it('captures where-filter fields as membership determinants', () => {
    const authors: { slug: string; fields: Field[] } = {
      slug: 'authors',
      fields: [{ name: 'live', type: 'join', collection: 'posts', on: 'author', where: { status: { equals: 'published' } } }],
    }
    expect(collectJoinMembership([authors]).posts).toEqual([{ on: 'author', determinants: ['status'] }])
  })

  it('merges hosts joining the same child on the same field, unioning determinants', () => {
    const authors: { slug: string; fields: Field[] } = {
      slug: 'authors',
      fields: [{ name: 'posts', type: 'join', collection: 'posts', on: 'author', where: { status: { equals: 'published' } } }],
    }
    const editors: { slug: string; fields: Field[] } = {
      slug: 'editors',
      fields: [{ name: 'posts', type: 'join', collection: 'posts', on: 'author', where: { featured: { equals: true } } }],
    }
    const posts = collectJoinMembership([authors, editors]).posts ?? []
    expect(posts).toHaveLength(1)
    expect(posts[0]?.on).toBe('author')
    expect([...(posts[0]?.determinants ?? [])].sort()).toEqual(['featured', 'status'])
  })

  it('fans out a polymorphic join to each child collection', () => {
    const owners: { slug: string; fields: Field[] } = {
      slug: 'owners',
      fields: [{ name: 'things', type: 'join', collection: ['posts', 'pages'], on: 'owner' }],
    }
    const index = collectJoinMembership([owners])
    expect(index.posts).toEqual([{ on: 'owner', determinants: [] }])
    expect(index.pages).toEqual([{ on: 'owner', determinants: [] }])
  })

  it('finds joins nested in groups and tabs', () => {
    const authors: { slug: string; fields: Field[] } = {
      slug: 'authors',
      fields: [
        { name: 'meta', type: 'group', fields: [{ name: 'posts', type: 'join', collection: 'posts', on: 'author' }] },
        { type: 'tabs', tabs: [{ name: 'work', fields: [{ name: 'drafts', type: 'join', collection: 'drafts', on: 'writer' }] }] },
      ],
    }
    const index = collectJoinMembership([authors])
    expect(index.posts).toEqual([{ on: 'author', determinants: [] }])
    expect(index.drafts).toEqual([{ on: 'writer', determinants: [] }])
  })
})

describe('extractOnValues', () => {
  it('reads a raw id (depth-0 previousDoc)', () => {
    expect(extractOnValues({ author: 7 }, 'author')).toEqual([7])
  })

  it('reads a populated doc (request-depth doc)', () => {
    expect(extractOnValues({ author: { id: 7, name: 'Ada' } }, 'author')).toEqual([7])
  })

  it('reads a polymorphic wrapper by its value', () => {
    expect(extractOnValues({ owner: { relationTo: 'authors', value: { id: 9 } } }, 'owner')).toEqual([9])
  })

  it('reads a hasMany array of mixed shapes, deduped', () => {
    expect(extractOnValues({ tags: [1, { id: 2 }, 1] }, 'tags').sort()).toEqual([1, 2])
  })

  it('resolves a dotted on path', () => {
    expect(extractOnValues({ meta: { author: 5 } }, 'meta.author')).toEqual([5])
  })

  it('returns empty for null / missing / non-id values', () => {
    expect(extractOnValues({}, 'author')).toEqual([])
    expect(extractOnValues({ author: null }, 'author')).toEqual([])
    expect(extractOnValues(undefined, 'author')).toEqual([])
  })
})

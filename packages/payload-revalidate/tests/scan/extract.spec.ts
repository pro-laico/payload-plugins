import { describe, expect, it } from 'vitest'
import { extractGetterCalls } from '../../src/scan/extract'

describe('extractGetterCalls', () => {
  it('extracts helper, slug, scope, label, enclosing getter, and line', () => {
    const source = `
import { cacheDoc, cacheIds } from '@pro-laico/payload-revalidate/cache'

export async function getPostIds() {
  'use cache'
  const res = await payload.find({ collection: 'posts', select: {}, depth: 0 })
  await cacheIds(res, 'posts', { list: 'recent', label: 'post-ids' })
  return res.docs.map((d) => d.id)
}

export const getPost = async (id: string) => {
  'use cache'
  return cacheDoc(await payload.findByID({ collection: 'posts', id, depth: 0 }), 'posts', { label: 'post-by-id' })
}
`
    const calls = extractGetterCalls(source)
    expect(calls).toEqual([
      { helper: 'cacheIds', slug: 'posts', list: 'recent', label: 'post-ids', getter: 'getPostIds', line: 7 },
      { helper: 'cacheDoc', slug: 'posts', list: undefined, label: 'post-by-id', getter: 'getPost', line: 13 },
    ])
  })

  it('finds the slug across a multiline call and inline fetches', () => {
    const source = `
export async function getHeader() {
  return cacheGlobal(
    await payload.findGlobal({ slug: 'header', depth: 0 }),
    'header',
  )
}
`
    expect(extractGetterCalls(source)).toEqual([
      { helper: 'cacheGlobal', slug: 'header', list: undefined, label: undefined, getter: 'getHeader', line: 3 },
    ])
  })

  it('skips calls whose slug is not a literal', () => {
    expect(extractGetterCalls('await cacheDoc(doc, collection)')).toEqual([])
  })

  it('does not grab quoted sort tokens from an inline first argument as the slug', () => {
    const source = `
export async function getFeatured() {
  await cacheIds(await payload.find({ collection: 'posts', sort: ['-featured', '-publishedAt'], depth: 0 }), 'posts', { list: 'featured' })
}
`
    expect(extractGetterCalls(source)).toEqual([
      { helper: 'cacheIds', slug: 'posts', list: 'featured', label: undefined, getter: 'getFeatured', line: 3 },
    ])
  })
})

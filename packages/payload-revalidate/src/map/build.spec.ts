import type { CollectionConfig, GlobalConfig } from 'payload'
import { describe, expect, it } from 'vitest'
import { buildStaticInspection } from './build'

const posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'slug', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'author', type: 'relationship', relationTo: 'authors' },
    { name: 'hero', type: 'upload', relationTo: 'media' },
  ],
}
const authors: CollectionConfig = { slug: 'authors', fields: [{ name: 'name', type: 'text' }] }
const media: CollectionConfig = { slug: 'media', upload: true, fields: [] }
const header: GlobalConfig = { slug: 'header', fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }] }

describe('buildStaticInspection', () => {
  it('resolves settings, graph, and rules from a config with no server', () => {
    const inspection = buildStaticInspection({ collections: [posts, authors, media], globals: [header] })
    expect(Object.keys(inspection.settings).sort()).toEqual(['authors', 'media', 'posts'])
    expect(inspection.settings.posts?.idField).toBe('slug') // inferred from the slug field
    expect(inspection.settings.posts?.fields).toEqual(['slug', 'title', 'author', 'hero'])
    expect(inspection.graph.globals).toEqual(['header'])
    expect(inspection.graph.edges.some((e) => e.from === 'posts' && e.to === 'media' && e.kind === 'upload')).toBe(true)
    // Static — nothing observed.
    expect(inspection.reads).toEqual([])
    expect(inspection.events).toEqual([])
    expect(inspection.observing).toBe(false)
  })

  it('reads prefix, opt-outs, and rules from the config.custom marker', () => {
    const inspection = buildStaticInspection({
      collections: [posts, authors, media],
      custom: {
        payloadRevalidate: {
          options: { prefix: 'shop', collections: { media: false }, rules: [{ on: 'authors', bust: ['posts'] }] },
          endpointPath: '/api/revalidate-map',
        },
      },
    })
    expect(inspection.prefix).toBe('shop')
    expect(inspection.settings.media).toBeUndefined() // opted out
    expect(inspection.rules).toEqual([{ on: 'authors', bust: ['posts'] }])
  })

  it('optionsOverride wins over the marker', () => {
    const inspection = buildStaticInspection(
      { collections: [posts], custom: { payloadRevalidate: { options: { prefix: 'shop' }, endpointPath: null } } },
      { prefix: 'blog' },
    )
    expect(inspection.prefix).toBe('blog')
  })

  it("drops Payload's internal collections and edges into them", () => {
    const withInternal: CollectionConfig = {
      slug: 'posts',
      fields: [{ name: 'folder', type: 'relationship', relationTo: 'payload-folders' }],
    }
    const inspection = buildStaticInspection({ collections: [withInternal, { slug: 'payload-folders', fields: [] }] })
    expect(Object.keys(inspection.settings)).toEqual(['posts'])
    expect(inspection.graph.edges.some((e) => e.to === 'payload-folders')).toBe(false)
  })
})

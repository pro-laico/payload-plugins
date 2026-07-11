import type { CollectionConfig, GlobalConfig } from 'payload'
import { describe, expect, it } from 'vitest'
import type { ReferenceEdge } from '../../src/types'
import { buildReferenceGraph } from '../../src/graph/referenceGraph'

const edge = (edges: ReferenceEdge[], via: string) => edges.find((e) => e.via === via)

describe('buildReferenceGraph', () => {
  it('collects relationship, upload, join, and richText edges with dotted paths', () => {
    const posts: CollectionConfig = {
      slug: 'posts',
      fields: [
        { name: 'author', type: 'relationship', relationTo: 'team' },
        { name: 'hero', type: 'upload', relationTo: 'media' },
        { name: 'comments', type: 'join', collection: 'comments', on: 'post' },
        { name: 'body', type: 'richText' },
      ],
    }
    const { collections, globals, edges } = buildReferenceGraph({ collections: [posts] })
    expect(collections).toEqual(['posts'])
    expect(globals).toEqual([])
    expect(edge(edges, 'author')).toMatchObject({ from: 'posts', to: 'team', kind: 'relationship' })
    expect(edge(edges, 'hero')).toMatchObject({ from: 'posts', to: 'media', kind: 'upload' })
    expect(edge(edges, 'comments')).toMatchObject({ from: 'posts', to: 'comments', kind: 'join' })
    expect(edge(edges, 'body')).toMatchObject({ from: 'posts', to: '*', kind: 'richText' })
  })

  it('recurses arrays, blocks (block slug in the path), groups, and named tabs', () => {
    const pages: CollectionConfig = {
      slug: 'pages',
      fields: [
        {
          name: 'layout',
          type: 'blocks',
          blocks: [{ slug: 'hero', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] }],
        },
        { name: 'gallery', type: 'array', fields: [{ name: 'shot', type: 'upload', relationTo: 'media' }] },
        { name: 'meta', type: 'group', fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] },
        {
          type: 'tabs',
          tabs: [
            { name: 'seo', fields: [{ name: 'social', type: 'upload', relationTo: 'media' }] },
            { label: 'Loose', fields: [{ name: 'banner', type: 'upload', relationTo: 'media' }] },
          ],
        },
      ],
    }
    const { edges } = buildReferenceGraph({ collections: [pages] })
    expect(edge(edges, 'layout.hero.image')).toBeDefined()
    expect(edge(edges, 'gallery.shot')).toBeDefined()
    expect(edge(edges, 'meta.og')).toBeDefined()
    expect(edge(edges, 'seo.social')).toBeDefined()
    expect(edge(edges, 'banner')).toBeDefined()
  })

  it('fans out polymorphic relationships and marks them', () => {
    const nav: GlobalConfig = { slug: 'nav', fields: [{ name: 'link', type: 'relationship', relationTo: ['pages', 'posts'] }] }
    const { globals, edges } = buildReferenceGraph({ globals: [nav] })
    expect(globals).toEqual(['nav'])
    expect(edges).toEqual([
      { from: 'global:nav', to: 'pages', via: 'link', kind: 'relationship', polymorphic: true },
      { from: 'global:nav', to: 'posts', via: 'link', kind: 'relationship', polymorphic: true },
    ])
  })

  it('resolves blockReferences through the config-level blocks registry', () => {
    const cta = { slug: 'cta', fields: [{ name: 'target', type: 'relationship' as const, relationTo: 'pages' }] }
    const pages: CollectionConfig = { slug: 'pages', fields: [{ name: 'layout', type: 'blocks', blockReferences: ['cta'], blocks: [] }] }
    const { edges } = buildReferenceGraph({ collections: [pages], blocks: [cta] })
    expect(edge(edges, 'layout.cta.target')).toMatchObject({ from: 'pages', to: 'pages', kind: 'relationship' })
  })
})

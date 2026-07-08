import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'
import { collectDepTags, indexSchema } from './collectTags'

const media = { slug: 'media', fields: [{ name: 'alt', type: 'text' }] as Field[] }
const team = {
  slug: 'team',
  fields: [{ name: 'avatar', type: 'upload', relationTo: 'media' }] as Field[],
}
const schema = indexSchema({ collections: [media, team] })

describe('collectDepTags (atomic: only baked-in content tags)', () => {
  it('never tags raw ids — references are the id-keyed getter’s job', () => {
    const fields: Field[] = [
      { name: 'author', type: 'relationship', relationTo: 'team' },
      { name: 'reviewers', type: 'relationship', relationTo: 'team', hasMany: true },
    ]
    const result = collectDepTags({ author: 7, reviewers: [8, 9] }, fields, schema)
    expect(result.tags).toEqual([])
    expect(result.embeds).toEqual([])
  })

  it('tags populated docs with provenance (via path + kind)', () => {
    const fields: Field[] = [
      { name: 'author', type: 'relationship', relationTo: 'team' },
      { name: 'hero', type: 'upload', relationTo: 'media' },
    ]
    const result = collectDepTags({ author: { id: 7 }, hero: { id: 3 } }, fields, schema)
    expect(result.tags.sort()).toEqual(['media:3', 'team:7'])
    expect(result.embeds).toContainEqual({ tag: 'team:7', via: 'author', kind: 'relationship' })
    expect(result.embeds).toContainEqual({ tag: 'media:3', via: 'hero', kind: 'upload' })
  })

  it('tags polymorphic values only when populated', () => {
    const fields: Field[] = [{ name: 'any', type: 'relationship', relationTo: ['team', 'media'], hasMany: true }]
    const doc = { any: [{ relationTo: 'team', value: 3 }, { relationTo: 'media', value: { id: 4 } }, 5] }
    expect(collectDepTags(doc, fields, schema).tags).toEqual(['media:4'])
  })

  it('recurses populated docs with their own schema, bounded by maxDepth', () => {
    const fields: Field[] = [{ name: 'author', type: 'relationship', relationTo: 'team' }]
    const doc = { author: { id: 7, avatar: { id: 12 } } }
    const result = collectDepTags(doc, fields, schema)
    expect(result.tags.sort()).toEqual(['media:12', 'team:7'])
    expect(result.embeds).toContainEqual({ tag: 'media:12', via: 'author.avatar', kind: 'upload' })
    expect(collectDepTags(doc, fields, schema, { maxDepth: 0 }).tags).toEqual(['team:7'])
  })

  it('survives reference cycles', () => {
    const buddies = { slug: 'buddies', fields: [{ name: 'friend', type: 'relationship', relationTo: 'buddies' }] as Field[] }
    const cyclic = indexSchema({ collections: [buddies] })
    const a: Record<string, unknown> = { id: 1 }
    const b = { id: 2, friend: a }
    a.friend = b
    expect(collectDepTags(a, buddies.fields, cyclic).tags.sort()).toEqual(['buddies:1', 'buddies:2'])
  })

  it('walks arrays, blocks (block slug in the path), groups, and named tabs', () => {
    const cta = { slug: 'cta', fields: [{ name: 'target', type: 'relationship', relationTo: 'team' }] as Field[] }
    const withBlocks = indexSchema({ collections: [media, team], blocks: [cta] })
    const fields: Field[] = [
      { name: 'gallery', type: 'array', fields: [{ name: 'shot', type: 'upload', relationTo: 'media' }] },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'hero', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] }],
        blockReferences: ['cta'],
      },
      { name: 'meta', type: 'group', fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] },
      { type: 'tabs', tabs: [{ name: 'seo', fields: [{ name: 'social', type: 'upload', relationTo: 'media' }] }] },
    ]
    const doc = {
      gallery: [{ shot: { id: 1 } }],
      layout: [
        { blockType: 'hero', image: { id: 3 } },
        { blockType: 'cta', target: { id: 7 } },
      ],
      meta: { og: { id: 4 } },
      seo: { social: { id: 5 } },
    }
    const result = collectDepTags(doc, fields, withBlocks)
    expect(result.tags.sort()).toEqual(['media:1', 'media:3', 'media:4', 'media:5', 'team:7'])
    expect(result.embeds).toContainEqual({ tag: 'media:1', via: 'gallery.shot', kind: 'upload' })
    expect(result.embeds).toContainEqual({ tag: 'media:3', via: 'layout.hero.image', kind: 'upload' })
    expect(result.embeds).toContainEqual({ tag: 'team:7', via: 'layout.cta.target', kind: 'relationship' })
    expect(result.embeds).toContainEqual({ tag: 'media:4', via: 'meta.og', kind: 'upload' })
    expect(result.embeds).toContainEqual({ tag: 'media:5', via: 'seo.social', kind: 'upload' })
  })

  it('finds POPULATED upload/relationship/link nodes inside Lexical richText, skipping id nodes', () => {
    const fields: Field[] = [{ name: 'body', type: 'richText' }]
    const doc = {
      body: {
        root: {
          children: [
            { type: 'upload', relationTo: 'media', value: { id: 42 } },
            { type: 'upload', relationTo: 'media', value: 43 },
            { type: 'paragraph', children: [{ type: 'link', fields: { doc: { relationTo: 'team', value: { id: 7 } } } }] },
          ],
        },
      },
    }
    const result = collectDepTags(doc, fields, schema)
    expect(result.tags.sort()).toEqual(['media:42', 'team:7'])
    expect(result.embeds.every((e) => e.kind === 'richText' && e.via === 'body')).toBe(true)
  })

  it('walks Lexical BLOCK nodes with the block schema — bare populated docs there carry no wrapper', () => {
    // A block node's `fields` hold ordinary Payload field data: a populated
    // single-relationTo relationship is a bare `{ id, … }` doc the generic
    // wrapper scan cannot see. The config-level blocks registry resolves it.
    const feature = { slug: 'feature', fields: [{ name: 'product', type: 'relationship', relationTo: 'team' }] as Field[] }
    const withBlocks = indexSchema({ collections: [media, team], blocks: [feature] })
    const fields: Field[] = [{ name: 'body', type: 'richText' }]
    const doc = {
      body: {
        root: {
          children: [
            { type: 'block', fields: { blockType: 'feature', product: { id: 7, name: 'Ada' } } },
            { type: 'inlineBlock', fields: { blockType: 'feature', product: { id: 8 } } },
            // Unknown block slug falls back to the generic scan (wrapped nodes still surface).
            { type: 'block', fields: { blockType: 'mystery', anything: { relationTo: 'media', value: { id: 3 } } } },
          ],
        },
      },
    }
    const result = collectDepTags(doc, fields, withBlocks)
    expect(result.tags.sort()).toEqual(['media:3', 'team:7', 'team:8'])
    expect(result.embeds).toContainEqual({ tag: 'team:7', via: 'body.feature.product', kind: 'relationship' })
  })

  it('tags populated join docs only', () => {
    const fields: Field[] = [{ name: 'posts', type: 'join', collection: 'posts', on: 'author' }]
    const postsIdx = indexSchema({ collections: [{ slug: 'posts', fields: [] }] })
    const doc = { posts: { docs: [11, { id: 12 }] } }
    expect(collectDepTags(doc, fields, postsIdx).tags).toEqual(['posts:12'])
  })

  it('emits a join MEMBERSHIP tag keyed by the owning doc id — even when members are ids', () => {
    // The membership dependency (needs busting on create/delete/reassign) is separate from
    // the baked members; it fires whether or not any member is populated.
    const fields: Field[] = [{ name: 'posts', type: 'join', collection: 'posts', on: 'author' }]
    const postsIdx = indexSchema({ collections: [{ slug: 'posts', fields: [] }] })
    const result = collectDepTags({ id: 5, posts: { docs: [11, { id: 12 }] } }, fields, postsIdx)
    expect(result.tags.sort()).toEqual(['posts:12', 'posts:join:author:5'])
    // The membership tag is a real dependency, NOT a baked-in refactor candidate.
    expect(result.embeds.some((e) => e.tag === 'posts:join:author:5')).toBe(false)

    // No membership tag when the owner has no id to key on.
    expect(collectDepTags({ posts: { docs: [] } }, fields, postsIdx).tags).toEqual([])
  })

  it('keys join membership by the populated PARENT doc, not the root entry', () => {
    const authors = { slug: 'authors', fields: [{ name: 'posts', type: 'join', collection: 'posts', on: 'author' }] as Field[] }
    const idx = indexSchema({ collections: [authors, { slug: 'posts', fields: [] }] })
    const fields: Field[] = [{ name: 'author', type: 'relationship', relationTo: 'authors' }]
    const result = collectDepTags({ id: 1, author: { id: 9, posts: { docs: [] } } }, fields, idx)
    expect(result.tags).toContain('posts:join:author:9')
    expect(result.tags).toContain('authors:9')
  })

  it('fans out a polymorphic join collection', () => {
    const fields: Field[] = [{ name: 'refs', type: 'join', collection: ['posts', 'pages'], on: 'owner' }]
    const idx = indexSchema({
      collections: [
        { slug: 'posts', fields: [] },
        { slug: 'pages', fields: [] },
      ],
    })
    expect(collectDepTags({ id: 3, refs: { docs: [] } }, fields, idx).tags.sort()).toEqual(['pages:join:owner:3', 'posts:join:owner:3'])
  })

  it('tags populated polymorphic-join members by their per-doc relationTo (Payload wraps them {relationTo, value})', () => {
    // Verified against @payloadcms/drizzle 3.85.1 read transform: polymorphic join rows come
    // back wrapped `{ relationTo, value }` (bare `{ id }` for single-collection joins), so the
    // wrapper carries each member's own collection — visitRelValue already resolves it.
    const idx = indexSchema({
      collections: [
        { slug: 'posts', fields: [] },
        { slug: 'pages', fields: [] },
      ],
    })
    const fields: Field[] = [{ name: 'refs', type: 'join', collection: ['posts', 'pages'], on: 'owner' }]
    const doc = {
      id: 3,
      refs: {
        docs: [
          { relationTo: 'posts', value: { id: 5 } },
          { relationTo: 'pages', value: { id: 6 } },
          { relationTo: 'posts', value: 7 }, // raw id — atomic, not tagged
        ],
      },
    }
    expect(collectDepTags(doc, fields, idx).tags.sort()).toEqual(['pages:6', 'pages:join:owner:3', 'posts:5', 'posts:join:owner:3'])
  })

  it('unwraps locale maps on localized fields', () => {
    const fields: Field[] = [{ name: 'hero', type: 'upload', relationTo: 'media', localized: true }]
    const doc = { hero: { en: { id: 1 }, de: { id: 2 } } }
    expect(collectDepTags(doc, fields, schema).tags.sort()).toEqual(['media:1', 'media:2'])
  })

  it('unwraps a localized GROUP fetched with locale:all — tags populated docs in every locale', () => {
    const idx = indexSchema({ collections: [media], localization: { locales: ['en', 'de'] } })
    const fields: Field[] = [{ name: 'meta', type: 'group', localized: true, fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] }]
    const doc = { meta: { en: { og: { id: 1 } }, de: { og: { id: 2 } } } }
    expect(collectDepTags(doc, fields, idx).tags.sort()).toEqual(['media:1', 'media:2'])
  })

  it('does NOT misread a single-locale localized group as a locale map', () => {
    const idx = indexSchema({ collections: [media], localization: { locales: ['en', 'de'] } })
    const fields: Field[] = [{ name: 'meta', type: 'group', localized: true, fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] }]
    expect(collectDepTags({ meta: { og: { id: 5 } } }, fields, idx).tags).toEqual(['media:5'])
  })

  it('unwraps a localized named TAB fetched with locale:all', () => {
    const idx = indexSchema({ collections: [media], localization: { locales: ['en', 'de'] } })
    const fields: Field[] = [
      { type: 'tabs', tabs: [{ name: 'seo', localized: true, fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] }] },
    ]
    const doc = { seo: { en: { og: { id: 3 } }, de: { og: { id: 4 } } } }
    expect(collectDepTags(doc, fields, idx).tags.sort()).toEqual(['media:3', 'media:4'])
  })

  it('without configured locale codes a group locale map is undetectable (documented limitation, safe under-tag)', () => {
    const idx = indexSchema({ collections: [media] }) // no localization → no codes
    const fields: Field[] = [{ name: 'meta', type: 'group', localized: true, fields: [{ name: 'og', type: 'upload', relationTo: 'media' }] }]
    const doc = { meta: { en: { og: { id: 1 } }, de: { og: { id: 2 } } } }
    expect(collectDepTags(doc, fields, idx).tags).toEqual([])
  })

  it('walks each doc of a list and dedupes shared embeds', () => {
    const fields: Field[] = [{ name: 'author', type: 'relationship', relationTo: 'team' }]
    const result = collectDepTags([{ author: { id: 7 } }, { author: { id: 7 } }, { author: { id: 8 } }], fields, schema)
    expect(result.tags.sort()).toEqual(['team:7', 'team:8'])
  })

  it('caps the tag count and reports it', () => {
    const fields: Field[] = [{ name: 'reviewers', type: 'relationship', relationTo: 'team', hasMany: true }]
    const doc = { reviewers: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })) }
    const result = collectDepTags(doc, fields, schema, { maxTags: 3 })
    expect(result.tags).toHaveLength(3)
    expect(result.capped).toBe(true)
  })

  it('never treats bare strings in text fields as ids', () => {
    const fields: Field[] = [{ name: 'title', type: 'text' }]
    expect(collectDepTags({ title: 'media:1 looks like a tag' }, fields, schema).tags).toEqual([])
  })
})

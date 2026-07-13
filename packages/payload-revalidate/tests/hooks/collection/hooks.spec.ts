import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionSettings } from '../../../src/types'
import { createTags } from '../../../src/lib/tags'
import { createAfterChange } from '../../../src/hooks/collection/afterChange'
import { createAfterDelete } from '../../../src/hooks/collection/afterDelete'

const bust = vi.fn()
vi.mock('../../../src/lib/bust', () => ({ bust: (...args: unknown[]) => bust(...args) }))

const settings: CollectionSettings = { idField: 'slug', lists: {}, extraTags: [] }
const scoped: Partial<CollectionSettings> = { lists: { recent: ['publishedAt'], featured: ['featured', 'publishedAt'] } }

type HookDoc = Record<string, unknown>

const change = async (
  doc: HookDoc,
  previousDoc: HookDoc | undefined,
  operation: 'create' | 'update',
  overrides: {
    settings?: Partial<CollectionSettings>
    rules?: Parameters<typeof createAfterChange>[0]['rules']
    diffSchema?: Parameters<typeof createAfterChange>[0]['diffSchema']
    joinRules?: Parameters<typeof createAfterChange>[0]['joinRules']
    context?: Record<string, unknown>
  } = {},
) => {
  const hook = createAfterChange({
    slug: 'posts',
    settings: { ...settings, ...overrides.settings },
    rules: overrides.rules ?? [],
    tags: createTags(),
    observe: false,
    diffSchema: overrides.diffSchema,
    joinRules: overrides.joinRules,
  })
  await hook({ doc, previousDoc, operation, req: { context: overrides.context ?? {} } } as never)
}

const bustedTags = (): string[] => (bust.mock.calls[0]?.[0] as { tag: string }[]).map((b) => b.tag)
const trigger = () => bust.mock.calls[0]?.[1] as Record<string, unknown>

describe('createAfterChange — field-driven decision table', () => {
  beforeEach(() => bust.mockReset())

  it('content-only edit (the common case): doc tags only, no list tags at all', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', body: 'new' },
      { id: 1, slug: 'hello', _status: 'published', body: 'old' },
      'update',
      { settings: scoped },
    )
    expect(bustedTags().sort()).toEqual(['posts:1', 'posts:1:draft', 'posts:hello', 'posts:hello:draft'].sort())
    expect(trigger()).toMatchObject({ operation: 'update' })
  })

  it('an edit to a scope’s declared field busts exactly that scope', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', featured: true },
      { id: 1, slug: 'hello', _status: 'published', featured: false },
      'update',
      { settings: scoped },
    )
    const tags = bustedTags()
    expect(tags).toContain('posts:list:featured')
    expect(tags).toContain('posts:list:featured:draft')
    expect(tags).not.toContain('posts:list:recent')
    expect(tags).not.toContain('posts')
  })

  it('a shared determinant busts every scope that declares it', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', publishedAt: '2026-02-01' },
      { id: 1, slug: 'hello', _status: 'published', publishedAt: '2026-01-01' },
      'update',
      { settings: scoped },
    )
    expect(bustedTags()).toContain('posts:list:recent')
    expect(bustedTags()).toContain('posts:list:featured')
  })

  it('create (membership): doc + alias + bare list + ALL scopes, both lanes', async () => {
    await change({ id: 1, slug: 'hello', _status: 'published' }, undefined, 'create', { settings: scoped })
    const tags = bustedTags()
    for (const tag of ['posts:1', 'posts:hello', 'posts', 'posts:draft', 'posts:list:recent', 'posts:list:featured', 'posts:list:recent:draft'])
      expect(tags).toContain(tag)
    expect(trigger()).toMatchObject({ operation: 'create', lane: 'published' })
  })

  it('publish transition (membership): bare + scopes busted, operation publish', async () => {
    await change({ id: 1, slug: 'hello', _status: 'published' }, { id: 1, slug: 'hello', _status: 'draft' }, 'update', { settings: scoped })
    expect(bustedTags()).toContain('posts')
    expect(bustedTags()).toContain('posts:list:recent')
    expect(trigger()).toMatchObject({ operation: 'publish' })
  })

  it('published → draft (unpublish OR draft-save-over-published — same signature): membership, both lanes', async () => {
    await change({ id: 1, slug: 'hello', _status: 'draft' }, { id: 1, slug: 'hello', _status: 'published' }, 'update', { settings: scoped })
    expect(bustedTags()).toContain('posts')
    expect(bustedTags()).toContain('posts:1')
    expect(trigger()).toMatchObject({ operation: 'update', lane: 'draft' })
  })

  it('alias change: old and new alias busted, lists NOT touched (id-lists hold ids)', async () => {
    await change({ id: 1, slug: 'new-slug', _status: 'published' }, { id: 1, slug: 'old-slug', _status: 'published' }, 'update', {
      settings: scoped,
    })
    const tags = bustedTags()
    for (const tag of ['posts:new-slug', 'posts:old-slug', 'posts:new-slug:draft', 'posts:old-slug:draft']) expect(tags).toContain(tag)
    expect(tags).not.toContain('posts')
    expect(tags).not.toContain('posts:list:recent')
  })

  it('draft save: draft lane only; scope fields changed → scope’s draft variant only', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'draft', publishedAt: 'b' },
      { id: 1, slug: 'hello', _status: 'draft', publishedAt: 'a' },
      'update',
      { settings: scoped },
    )
    const tags = bustedTags()
    expect(tags.sort()).toEqual(['posts:1:draft', 'posts:hello:draft', 'posts:list:recent:draft', 'posts:list:featured:draft'].sort())
    expect(trigger()).toMatchObject({ lane: 'draft', operation: 'update' })
  })

  it('collections without drafts always bust both lanes', async () => {
    await change({ id: 1, slug: 'hello', title: 'b' }, { id: 1, slug: 'hello', title: 'a' }, 'update')
    expect(bustedTags()).toContain('posts:1')
    expect(bustedTags()).toContain('posts:1:draft')
  })

  it('extraTags and whenFields-gated rules fire on published writes', async () => {
    const rules = [
      { on: 'posts', bust: ['sitemap-posts'], whenFields: ['slug'] },
      { on: 'posts', bust: ['never'], whenFields: ['other'] },
      { on: 'faqs', bust: ['not-mine'] },
    ]
    await change({ id: 1, slug: 'new', _status: 'published' }, { id: 1, slug: 'old', _status: 'published' }, 'update', {
      settings: { extraTags: ['sitemap'] },
      rules,
    })
    expect(bustedTags()).toContain('sitemap')
    expect(bustedTags()).toContain('sitemap-posts')
    expect(bustedTags()).not.toContain('never')
    expect(bustedTags()).not.toContain('not-mine')
  })

  it('draft saves skip rules and bust only the extraTags draft variants', async () => {
    await change({ id: 1, slug: 'hello', _status: 'draft', body: 'b' }, { id: 1, slug: 'hello', _status: 'draft', body: 'a' }, 'update', {
      settings: { extraTags: ['sitemap'] },
      rules: [{ on: 'posts', bust: ['ruled'] }],
    })
    // Draft reads carrying an extra tag carry its `:draft` variant too — a draft save
    // must reach THEM without purging the published surface.
    expect(bustedTags()).toContain('sitemap:draft')
    expect(bustedTags()).not.toContain('sitemap')
    expect(bustedTags()).not.toContain('ruled')
  })

  it('a publish fires whenFields rules even when the publish-time diff is empty (edits arrived via draft saves)', async () => {
    // previousDoc is the LATEST version — the draft that already holds the new value —
    // so the field diff at publish is empty. Membership must fire the rule anyway.
    await change(
      { id: 1, slug: 'hello', _status: 'published', question: 'B' },
      { id: 1, slug: 'hello', _status: 'draft', question: 'B' },
      'update',
      { rules: [{ on: 'posts', bust: ['services-faq'], whenFields: ['question'] }] },
    )
    expect(bustedTags()).toContain('services-faq')
    expect(trigger()).toMatchObject({ operation: 'publish' })
  })

  it('trash (deletedAt set) and restore are membership events — an edit while trashed is not', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', deletedAt: '2026-07-06' },
      { id: 1, slug: 'hello', _status: 'published', deletedAt: null },
      'update',
      { settings: scoped },
    )
    expect(bustedTags()).toContain('posts')
    expect(bustedTags()).toContain('posts:list:recent')

    bust.mockReset()
    await change(
      { id: 1, slug: 'hello', _status: 'published', deletedAt: null },
      { id: 1, slug: 'hello', _status: 'published', deletedAt: '2026-07-06' },
      'update',
      { settings: scoped },
    )
    expect(bustedTags()).toContain('posts')

    bust.mockReset()
    await change(
      { id: 1, slug: 'hello', _status: 'published', deletedAt: '2026-07-06', body: 'b' },
      { id: 1, slug: 'hello', _status: 'published', deletedAt: '2026-07-06', body: 'a' },
      'update',
      { settings: scoped },
    )
    expect(bustedTags()).not.toContain('posts')
  })

  it('dotted-path determinants compare the exact path, not just the container', async () => {
    const dotted = { lists: { team: ['contact.email'] } }
    await change(
      { id: 1, slug: 'hello', _status: 'published', contact: { email: 'new@x.com', phone: '1' } },
      { id: 1, slug: 'hello', _status: 'published', contact: { email: 'old@x.com', phone: '1' } },
      'update',
      { settings: dotted },
    )
    expect(bustedTags()).toContain('posts:list:team')

    bust.mockReset()
    await change(
      { id: 1, slug: 'hello', _status: 'published', contact: { email: 'same@x.com', phone: '2' } },
      { id: 1, slug: 'hello', _status: 'published', contact: { email: 'same@x.com', phone: '1' } },
      'update',
      { settings: dotted },
    )
    expect(bustedTags()).not.toContain('posts:list:team')
  })

  it('relationship determinants compare by id — a populated doc vs its raw id is NOT a change', async () => {
    const byAuthor = { settings: { lists: { byAuthor: ['author'] } }, diffSchema: { relationFields: ['author'] } }
    // Payload returns `doc` at request depth (populated) but `previousDoc` at depth 0 (id).
    await change(
      { id: 1, slug: 'hello', _status: 'published', author: { id: 5, name: 'Ada' }, body: 'b' },
      { id: 1, slug: 'hello', _status: 'published', author: 5, body: 'a' },
      'update',
      byAuthor,
    )
    expect(bustedTags()).not.toContain('posts:list:byAuthor')

    bust.mockReset()
    await change(
      { id: 1, slug: 'hello', _status: 'published', author: { id: 6, name: 'Bo' } },
      { id: 1, slug: 'hello', _status: 'published', author: 5 },
      'update',
      byAuthor,
    )
    expect(bustedTags()).toContain('posts:list:byAuthor')
  })

  it('join fields are derived query results — excluded from the diff entirely', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', related: { docs: [1, 2, 3] } },
      { id: 1, slug: 'hello', _status: 'published', related: { docs: [1] } },
      'update',
      { diffSchema: { ignoreFields: ['related'] }, rules: [{ on: 'posts', bust: ['ruled'], whenFields: ['related'] }] },
    )
    expect(bustedTags()).not.toContain('ruled')
  })

  it('join membership: a create busts the new parent’s join tag (both lanes)', async () => {
    await change({ id: 1, slug: 'hello', _status: 'published', author: 5 }, undefined, 'create', {
      joinRules: [{ on: 'author', determinants: [] }],
    })
    const tags = bustedTags()
    expect(tags).toContain('posts:join:author:5')
    expect(tags).toContain('posts:join:author:5:draft')
  })

  it('join membership: reassignment busts the old AND new parent, never the ones it stayed in', async () => {
    // doc is request-depth (populated author), previousDoc is depth-0 (raw id) — the
    // extractor normalizes both to ids, so this reads as a real reassignment 5 → 6.
    await change(
      { id: 1, slug: 'hello', _status: 'published', author: { id: 6, name: 'Bo' } },
      { id: 1, slug: 'hello', _status: 'published', author: 5 },
      'update',
      { joinRules: [{ on: 'author', determinants: [] }] },
    )
    const tags = bustedTags()
    expect(tags).toContain('posts:join:author:5')
    expect(tags).toContain('posts:join:author:6')
  })

  it('join membership: a content-only edit (parent unchanged) busts NO join tag', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', author: { id: 5 }, body: 'b' },
      { id: 1, slug: 'hello', _status: 'published', author: 5, body: 'a' },
      'update',
      { joinRules: [{ on: 'author', determinants: [] }] },
    )
    expect(bustedTags().some((t) => t.startsWith('posts:join:'))).toBe(false)
  })

  it('join membership: a where-determinant change flips the child in/out of the parent’s filtered join', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', author: 5, status: 'published' },
      { id: 1, slug: 'hello', _status: 'published', author: 5, status: 'draft' },
      'update',
      { joinRules: [{ on: 'author', determinants: ['status'] }] },
    )
    expect(bustedTags()).toContain('posts:join:author:5')
  })

  it('join membership: a hasMany on field busts every gained/lost parent', async () => {
    await change(
      { id: 1, slug: 'hello', _status: 'published', tags: [1, 2] },
      { id: 1, slug: 'hello', _status: 'published', tags: [2, 3] },
      'update',
      { joinRules: [{ on: 'tags', determinants: [] }] },
    )
    const tags = bustedTags()
    expect(tags).toContain('posts:join:tags:1') // gained
    expect(tags).toContain('posts:join:tags:3') // lost
    expect(tags).not.toContain('posts:join:tags:2') // stayed
  })

  it('join membership: a draft-lane save busts only the draft join variant', async () => {
    await change({ id: 1, slug: 'hello', _status: 'draft', author: 5 }, undefined, 'create', {
      joinRules: [{ on: 'author', determinants: [] }],
    })
    const tags = bustedTags()
    expect(tags).toContain('posts:join:author:5:draft')
    expect(tags).not.toContain('posts:join:author:5')
  })

  it('idField false: no alias tags', async () => {
    await change({ id: 1, slug: 'hello', _status: 'published' }, undefined, 'create', { settings: { idField: false } })
    expect(bustedTags()).not.toContain('posts:hello')
  })

  it('honors context.disableRevalidate', async () => {
    await change({ id: 1, _status: 'published' }, undefined, 'create', { context: { disableRevalidate: true } })
    expect(bust).not.toHaveBeenCalled()
  })
})

describe('createAfterDelete', () => {
  beforeEach(() => bust.mockReset())

  it('busts doc, alias, bare list + all scopes (both lanes) and fires rules unconditionally', async () => {
    const hook = createAfterDelete({
      slug: 'posts',
      settings: { ...settings, ...scoped } as CollectionSettings,
      rules: [{ on: 'posts', bust: ['ruled'], whenFields: ['whatever'] }],
      tags: createTags(),
      observe: false,
    })
    await hook({ doc: { id: 1, slug: 'bye' }, req: { context: {} } } as never)
    const tags = bustedTags()
    for (const tag of ['posts:1', 'posts:1:draft', 'posts:bye', 'posts', 'posts:draft', 'posts:list:recent', 'posts:list:featured', 'ruled'])
      expect(tags).toContain(tag)
    expect(trigger()).toMatchObject({ operation: 'delete' })
  })

  it('busts the join membership of every parent the deleted child was in', async () => {
    const hook = createAfterDelete({
      slug: 'posts',
      settings,
      rules: [],
      tags: createTags(),
      observe: false,
      joinRules: [{ on: 'author', determinants: [] }],
    })
    await hook({ doc: { id: 1, slug: 'bye', author: { id: 5 } }, req: { context: {} } } as never)
    const tags = bustedTags()
    expect(tags).toContain('posts:join:author:5')
    expect(tags).toContain('posts:join:author:5:draft')
  })

  it('honors context.disableRevalidate', async () => {
    const hook = createAfterDelete({ slug: 'posts', settings, rules: [], tags: createTags(), observe: false })
    await hook({ doc: { id: 1 }, req: { context: { disableRevalidate: true } } } as never)
    expect(bust).not.toHaveBeenCalled()
  })
})

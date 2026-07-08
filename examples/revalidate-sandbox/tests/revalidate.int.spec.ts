import config from '@payload-config'
import { getInspection, type RevalidateEvent } from '@pro-laico/payload-revalidate'
import { seed } from '@pro-laico/payload-seed'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedOptions } from '@/plugins'

// Integration: boots the real sandbox config (sqlite) and asserts payload-revalidate's
// write side end-to-end through the OBSERVED EVENTS — `revalidateTag` itself no-ops
// outside a Next request scope (by design), but every bust is recorded first, so the
// event log is the truthful record of what would have been purged.

let payload: Payload

const lastEvent = (): RevalidateEvent => {
  const event = getInspection()?.events[0]
  if (!event) throw new Error('no revalidation events recorded')
  return event
}
const bustedTags = (event: RevalidateEvent): string[] => event.busted.map((b) => b.tag)

beforeAll(async () => {
  payload = await getPayload({ config })
  await seed({ payload, options: seedOptions })
})

afterAll(async () => {
  await (payload as unknown as { destroy?: () => Promise<void> }).destroy?.()
})

describe('plugin wiring', () => {
  it('writes the discovery marker and attaches hooks to every collection and global', () => {
    expect(payload.config.custom?.payloadRevalidate).toMatchObject({ endpointPath: '/api/revalidate-map' })
    for (const slug of ['posts', 'services', 'media', 'users'] as const) {
      expect(payload.collections[slug]?.config.hooks.afterChange.length, slug).toBeGreaterThan(0)
      expect(payload.collections[slug]?.config.hooks.afterDelete.length, slug).toBeGreaterThan(0)
    }
    expect(payload.config.globals.find((g) => g.slug === 'site-settings')?.hooks?.afterChange?.length).toBeGreaterThan(0)
  })

  it('derives the static reference graph from the schema (relationship, upload, richText)', () => {
    const edges = getInspection()?.graph.edges ?? []
    expect(edges).toContainEqual({ from: 'posts', to: 'media', via: 'heroImage', kind: 'upload' })
    expect(edges).toContainEqual({ from: 'posts', to: 'services', via: 'relatedService', kind: 'relationship' })
    expect(edges).toContainEqual({ from: 'posts', to: '*', via: 'body', kind: 'richText' })
  })
})

describe('seed integration', () => {
  it('the after-seed listener busts per touched slug (bare + declared scopes) + globals + all', () => {
    const event = lastEvent()
    expect(event).toMatchObject({ source: 'seed', trigger: { operation: 'seed' } })
    const tags = bustedTags(event)
    for (const tag of ['media', 'services', 'posts', 'posts:draft', 'posts:list:featured', 'global:site-settings', 'all'])
      expect(tags).toContain(tag)
  })
})

describe('write-side hooks (decision table, end-to-end)', () => {
  it('a content-only published edit busts the doc tags and keeps the list tag quiet', async () => {
    const post = (await payload.find({ collection: 'posts', limit: 1, depth: 0 })).docs[0]
    if (!post) throw new Error('seed produced no post')
    await payload.update({ collection: 'posts', id: post.id, data: { excerpt: 'edited' } })

    const event = lastEvent()
    expect(event.trigger).toMatchObject({ slug: 'posts', id: post.id, operation: 'update', lane: 'published' })
    const tags = bustedTags(event)
    expect(tags).toContain(`posts:${post.id}`)
    expect(tags).toContain(`posts:${post.slug}`)
    expect(tags).toContain(`posts:${post.id}:draft`)
    expect(tags).not.toContain('posts')
  })

  it('a slug change busts old and new alias tags — id-lists hold ids, so no list bust', async () => {
    const post = (await payload.find({ collection: 'posts', limit: 1, depth: 0 })).docs[0]
    if (!post) throw new Error('no post')
    await payload.update({ collection: 'posts', id: post.id, data: { slug: 'renamed' } })

    const tags = bustedTags(lastEvent())
    expect(tags).toContain('posts:renamed')
    expect(tags).toContain(`posts:${post.slug}`)
    expect(tags).not.toContain('posts')
    expect(tags).not.toContain('posts:list:featured')
    await payload.update({ collection: 'posts', id: post.id, data: { slug: post.slug as string } })
  })

  it("flipping a scope's determinant busts exactly that scoped list tag", async () => {
    const post = (await payload.find({ collection: 'posts', limit: 1, depth: 0 })).docs[0]
    if (!post) throw new Error('no post')
    await payload.update({ collection: 'posts', id: post.id, data: { featured: !post.featured } })

    const tags = bustedTags(lastEvent())
    expect(tags).toContain('posts:list:featured')
    expect(tags).toContain('posts:list:featured:draft')
    expect(tags).not.toContain('posts')
    await payload.update({ collection: 'posts', id: post.id, data: { featured: post.featured } })
  })

  it('a draft save on a draft-only doc busts only draft-lane tags', async () => {
    const draft = await payload.create({
      collection: 'posts',
      data: { title: 'WIP', slug: 'wip', _status: 'draft' },
      draft: true,
    })
    await payload.update({ collection: 'posts', id: draft.id, data: { title: 'WIP 2' }, draft: true })

    const event = lastEvent()
    expect(event.trigger.lane).toBe('draft')
    const tags = bustedTags(event)
    expect(tags).toContain(`posts:${draft.id}:draft`)
    expect(tags).not.toContain(`posts:${draft.id}`)
    expect(tags).not.toContain('posts')
    await payload.delete({ collection: 'posts', id: draft.id })
  })

  it('a draft save OVER a published doc busts both lanes (indistinguishable from unpublish)', async () => {
    const post = (await payload.find({ collection: 'posts', limit: 1, depth: 0 })).docs[0]
    if (!post) throw new Error('no post')
    await payload.update({ collection: 'posts', id: post.id, data: { title: 'Draft title' }, draft: true })

    const tags = bustedTags(lastEvent())
    expect(tags).toContain(`posts:${post.id}:draft`)
    expect(tags).toContain(`posts:${post.id}`)
  })

  it('a delete busts doc + alias + list, both lanes', async () => {
    const created = await payload.create({
      collection: 'services',
      data: { title: 'Temp', slug: 'temp', summary: 'temp' },
    })
    await payload.delete({ collection: 'services', id: created.id })

    const event = lastEvent()
    expect(event.trigger).toMatchObject({ slug: 'services', operation: 'delete' })
    const tags = bustedTags(event)
    for (const tag of [`services:${created.id}`, 'services:temp', 'services', 'services:draft']) expect(tags).toContain(tag)
  })

  it('a create busts membership: bare list + every declared scope', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: { title: 'New', slug: 'new-post', _status: 'published' },
    })
    const tags = bustedTags(lastEvent())
    for (const tag of ['posts', 'posts:draft', 'posts:list:featured', `posts:${created.id}`]) expect(tags).toContain(tag)
    await payload.delete({ collection: 'posts', id: created.id })
  })

  it('a global save busts its tags', async () => {
    await payload.updateGlobal({ slug: 'site-settings', data: { siteName: 'Renamed' } })
    expect(bustedTags(lastEvent())).toContain('global:site-settings')
  })

  it('honors context.disableRevalidate', async () => {
    const before = getInspection()?.events.length ?? 0
    const post = (await payload.find({ collection: 'posts', limit: 1, depth: 0 })).docs[0]
    if (!post) throw new Error('no post')
    await payload.update({ collection: 'posts', id: post.id, data: { excerpt: 'quiet' }, context: { disableRevalidate: true } })
    expect(getInspection()?.events.length ?? 0).toBe(before)
  })
})

// Sibling plugins integrate through DATA-ONLY `custom.revalidate` markers on the collections
// they contribute — no wiring in this sandbox's revalidatePlugin() call (see src/plugins).
describe('sibling-plugin markers (icons, images)', () => {
  it('hooks the plugin-contributed collections; the iconRequest marker opts it out', () => {
    for (const slug of ['icon', 'iconSet', 'images'] as const) {
      expect(payload.collections[slug]?.config.hooks.afterChange.length, slug).toBeGreaterThan(0)
      expect(payload.collections[slug]?.config.hooks.afterDelete.length, slug).toBeGreaterThan(0)
    }
    // iconRequest carries `custom: { revalidate: false }` — only its own hooks (none), no bust hook.
    expect(payload.collections.iconRequest?.config.hooks.afterChange.length).toBe(0)
    expect(payload.collections.iconRequest?.config.hooks.afterDelete.length).toBe(0)
  })

  it("an icon-set write busts the shared 'payload-icons' extra tag from the marker", async () => {
    const set = (await payload.find({ collection: 'iconSet', limit: 1, depth: 0 })).docs[0]
    if (!set) throw new Error('seed produced no icon set')
    await payload.update({ collection: 'iconSet', id: set.id, data: { title: 'Default (renamed)' } })

    const event = lastEvent()
    expect(event.trigger).toMatchObject({ slug: 'iconSet', operation: 'update' })
    const tags = bustedTags(event)
    expect(tags).toContain('payload-icons')
    expect(tags).toContain(`iconSet:${set.id}`)
    await payload.update({ collection: 'iconSet', id: set.id, data: { title: 'Default' } })
  })

  it("an icon write busts 'payload-icons' too — re-uploading an SVG refreshes every baked-in render", async () => {
    const icon = (await payload.find({ collection: 'icon', limit: 1, depth: 0 })).docs[0]
    if (!icon) throw new Error('seed produced no icon')
    await payload.update({ collection: 'icon', id: icon.id, data: {} })
    expect(bustedTags(lastEvent())).toContain('payload-icons')
  })

  it('an image edit busts images:{id} — the one cacheDoc entry rendering it — and keeps the list quiet', async () => {
    const image = (await payload.find({ collection: 'images', limit: 1, depth: 0 })).docs[0]
    if (!image) throw new Error('seed produced no image')
    await payload.update({ collection: 'images', id: image.id, data: { alt: 'edited alt' } })

    const event = lastEvent()
    expect(event.trigger).toMatchObject({ slug: 'images', id: image.id, operation: 'update' })
    const tags = bustedTags(event)
    expect(tags).toContain(`images:${image.id}`)
    expect(tags).not.toContain('images')
  })
})

import { revalidatePlugin } from '@pro-laico/payload-revalidate'
import * as cacheModule from '@pro-laico/payload-revalidate/cache'
import { type CacheHelpers, createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
import type { CollectionConfig, Config, Payload, PayloadRequest } from 'payload'
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { bootLab, type LabBoot } from '@/boot'
import { createReport } from './report'

// payload-revalidate failure paths WITHOUT a Next server. Everything Next-facing
// (revalidateTag, cacheTag) throws outside a request/'use cache' scope, and the plugin's
// whole failure story is that those throws NEVER break a Payload write or a getter. Two
// diagnosis channels (both spies, not the log capture):
//   • misuse ADVISORIES (bake-ins, content-carrying id-lists, undeclared scopes) —
//     dev-only console.warn, naming the read, the offender, and the exact fix;
//   • DEGRADATION alerts (cacheTag failed → untagged entry, marker missing → unprefixed
//     unbustable entries) — console.error in EVERY environment, once per process per
//     failure kind, because silent prod degradation means permanently stale content. The
//     no-op revalidateTag warning fires once per process in every env too (a prod jobs
//     runner hitting it must be visible in logs).
// The observation registry still records intent throughout. The helpers are seeded ONCE
// with the lab's live handle (createCacheHelpers) — the doctrine: package code never
// resolves Payload or config itself.

const record = createReport('payload-revalidate')

// The one surviving globalThis slot (a FUNCTION contract, not a config stash) — corrupted
// on purpose below to simulate "plugin never ran here", and always restored.
const INSPECT_SLOT = Symbol.for('pro-laico.payload-revalidate.inspect')

const Media: CollectionConfig = { slug: 'media', fields: [{ name: 'alt', type: 'text' }] }

const Posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'slug', type: 'text' },
    { name: 'order', type: 'number' },
    { name: 'hero', type: 'relationship', relationTo: 'media' },
    { name: 'gallery', type: 'relationship', relationTo: 'media', hasMany: true },
  ],
}

let lab: LabBoot
let payload: Payload
let cacheDoc: CacheHelpers['cacheDoc']
let cacheIds: CacheHelpers['cacheIds']

const getHandler = (method: string, path: string) => {
  const ep = payload.config.endpoints.find((e) => e.method === method && e.path === path)
  if (!ep) throw new Error(`endpoint ${method} ${path} not registered — paths: ${payload.config.endpoints.map((e) => e.path).join(', ')}`)
  return ep.handler
}

interface MapSnapshot {
  settings: Record<string, { idField: string | false; lists: Record<string, string[]>; fields: string[] }>
  reads: Array<{ kind: string; list?: string; undeclared?: boolean; label?: string; staticTags: string[] }>
  events: Array<{ source: string; trigger: { slug: string; operation: string; lane: string }; busted: Array<{ tag: string; reason: string }> }>
}

const fetchMap = async (): Promise<MapSnapshot> => {
  const res = await getHandler('get', '/revalidate-map')({ payload } as unknown as PayloadRequest)
  expect(res.status).toBe(200)
  return (await res.json()) as MapSnapshot
}

/** Capture console.warn (the plugin's dev-advisory channel) as joined strings. */
const spyWarn = () => {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  return { spy, messages: () => spy.mock.calls.map((c) => c.map(String).join(' ')) }
}

/** Capture console.error (the plugin's every-env degradation channel) as joined strings. */
const spyError = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  return { spy, messages: () => spy.mock.calls.map((c) => c.map(String).join(' ')) }
}

beforeAll(async () => {
  lab = await bootLab({
    plugins: [revalidatePlugin({ observe: true, collections: { posts: { lists: { recent: { fields: ['order'] } } } } })],
    collections: [Posts, Media],
  })
  payload = lab.payload
  // The app-side seam: seed the read helpers once with the lab's one live session.
  ;({ cacheDoc, cacheIds } = createCacheHelpers(payload))
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('write side outside a request scope (CLI seeds, payload run scripts)', () => {
  it('the hook write SUCCEEDS; every env gets ONE no-op warning naming the tag, the why, and the prod stakes', async () => {
    const { messages } = spyWarn()
    const doc = (await payload.create({
      collection: 'posts' as never,
      data: { title: 'First Post', slug: 'first-post', order: 1 } as never,
    })) as unknown as { id: string | number }
    expect(doc.id).toBeTruthy() // revalidateTag exploding never fails the write

    const warn = messages().find((m) => m.includes('[payload-revalidate]'))
    expect(warn).toContain("revalidateTag('posts:") // names the tag it tried to bust
    expect(warn).toContain('no Next request scope in this process') // the why
    expect(warn).toContain('Normal for CLI seeds') // the benign reading
    expect(warn).toContain('revalidation is NOT reaching the cache') // the prod stakes (jobs runners)

    // Warned ONCE per process — a seed of 500 docs must not print 500 of these.
    const before = messages().filter((m) => m.includes('[payload-revalidate]')).length
    await payload.create({ collection: 'posts' as never, data: { title: 'Second', slug: 'second-post' } as never })
    const after = messages().filter((m) => m.includes('[payload-revalidate]')).length
    expect(after).toBe(before)
    record('hook write with no request scope', warn, `subsequent writes: no repeat warning (${before} total)`)
  })

  it('the event is still recorded — the map shows intent even where Next is unreachable', async () => {
    const map = await fetchMap()
    // Events are newest-first — pick the FIRST post's create by its alias tag.
    const event = map.events.find((e) => e.trigger.operation === 'create' && e.busted.some((b) => b.tag === 'posts:first-post'))
    expect(event?.source).toBe('hook')
    expect(event?.busted).toContainEqual({ tag: 'posts:first-post', reason: 'alias' }) // human-keyed, not just the db id
    expect(event?.busted).toContainEqual({ tag: 'posts:list:recent', reason: 'list' })
    record(
      'event recorded despite the no-op',
      `trigger: ${JSON.stringify(event?.trigger)}`,
      `busted: ${event?.busted.map((b) => `${b.tag} (${b.reason})`).join(', ')}`,
    )
  })
})

describe('read-side misuse (cache helpers) — dev advisories that name the read and the fix', () => {
  it("outside a 'use cache' scope, cacheDoc still returns the doc — with an every-env alert naming the stakes", async () => {
    const { messages } = spyError()
    const doc = { id: 1, title: 'Plain' }
    await expect(cacheDoc(doc, 'posts', { label: 'plainPost' })).resolves.toBe(doc) // never throws at the getter
    const alert = messages().find((m) => m.includes('cacheTag failed'))
    expect(alert).toContain('materializing UNTAGGED') // the stakes: an untagged entry can never revalidate
    expect(alert).toContain("inside a 'use cache' function") // the fix
    record("cacheDoc outside 'use cache'", alert)
  })

  it('a baked-in populated doc is flagged with its field path, its tag, and the atomic fix', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { messages } = spyWarn()
    await cacheDoc({ id: 2, title: 'Baked', hero: { id: 7, alt: 'Hero Image' } }, 'posts', { label: 'bakedPost' })
    const warn = messages().find((m) => m.includes('bakes in'))
    expect(warn).toContain('bakedPost bakes in 1 populated doc(s): hero → media:7') // path → tag provenance
    expect(warn).toContain('fetch shallow (depth: 0)') // the fix
    record('populated doc baked into an entry', warn)
  })

  it('a capped walk (maxTags hit) warns that the entry may UNDER-tag — stale risk', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { messages } = spyWarn()
    await cacheDoc(
      {
        id: 3,
        title: 'Gallery',
        gallery: [
          { id: 8, alt: 'A' },
          { id: 9, alt: 'B' },
        ],
      },
      'posts',
      { label: 'cappedPost', walk: { maxTags: 1 } },
    )
    const warn = messages().find((m) => m.includes('maxTags'))
    expect(warn).toContain('cappedPost: bake-in walk hit maxTags — this entry may under-tag')
    record('walk capped at maxTags', warn)
  })

  it('cacheIds fed full docs warns it tags MEMBERSHIP ONLY — content edits will go stale', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { messages } = spyWarn()
    await cacheIds({ docs: [{ id: 1, title: 'Fat Doc', order: 2 }] }, 'posts', { label: 'fatList' })
    const warn = messages().find((m) => m.includes('carrying content'))
    expect(warn).toContain('fatList received docs carrying content (title, order') // names the offending fields
    expect(warn).toContain('cacheIds tags membership only')
    expect(warn).toContain('select: {}') // the fix
    record('cacheIds fed full docs', warn)
  })

  it('an UNDECLARED list scope warns with the exact plugin-options snippet to declare it', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { messages } = spyWarn()
    await cacheIds({ docs: [] }, 'posts', { list: 'trending', label: 'trendList' })
    const warn = messages().find((m) => m.includes('undeclared'))
    expect(warn).toContain("trendList carries undeclared list scope 'trending' — reorders won't bust it")
    expect(warn).toContain("revalidatePlugin({ collections: { posts: { lists: { trending: { fields: ['<sort/filter fields>'] } } } } })")
    record('undeclared list scope', warn)
  })

  it('a DECLARED scope stays quiet, and the map flags only the undeclared read', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { messages } = spyWarn()
    await cacheIds({ docs: [] }, 'posts', { list: 'recent', label: 'okList' })
    expect(messages().filter((m) => m.includes('undeclared'))).toEqual([])

    const map = await fetchMap()
    const trending = map.reads.find((r) => r.kind === 'ids' && r.list === 'trending')
    const recent = map.reads.find((r) => r.kind === 'ids' && r.list === 'recent')
    expect(trending?.undeclared).toBe(true) // the dev map's loud flag
    expect(recent?.undeclared).toBeUndefined()
    record(
      'declared vs undeclared on the map',
      `trending read: undeclared=${String(trending?.undeclared)}`,
      `recent read: undeclared=${String(recent?.undeclared)}`,
    )
  })
})

describe('marker missing (helpers seeded with a handle whose config never saw revalidatePlugin)', () => {
  it('cacheDoc degrades — doc returned, unprefixed tags, scope status unknowable — with an every-env alert naming the fix', async () => {
    // A handle from a config built WITHOUT the plugin: real schema, no marker. This is the
    // new failure mode replacing the old "config unreachable" stash/alias machinery — the
    // handle always carries ITS config, so the only way to be under-wired is to have never
    // applied the plugin to it.
    const bare = { config: { collections: payload.config.collections, globals: payload.config.globals, custom: {} } } as unknown as Payload
    const bareHelpers = createCacheHelpers(bare)

    const { messages } = spyError()
    const doc = { id: 4, title: 'Orphan', hero: { id: 7, alt: 'Hero' } }
    await expect(bareHelpers.cacheDoc(doc, 'posts', { label: 'orphanPost' })).resolves.toBe(doc) // never throws
    const alert = messages().find((m) => m.includes('payloadRevalidate marker'))
    expect(alert).toContain('tags are UNPREFIXED') // the stakes...
    expect(alert).toContain('silently unbustable') // ...no hooks exist to bust these entries
    expect(alert).toContain('Add revalidatePlugin() to the plugins array') // the fix
    record('marker missing (plugin never applied to this handle)', alert)
  })

  it('getPayloadClient is gone — the package no longer resolves Payload for anyone', () => {
    // The doctrine made structural: the old self-resolving entry point does not exist.
    expect('getPayloadClient' in cacheModule).toBe(false)
    record('getPayloadClient removed', "'getPayloadClient' in the ./cache module: false")
  })
})

describe('map endpoint failures', () => {
  it('GET serves the legible settings surface (the baseline the failures degrade from)', async () => {
    const map = await fetchMap()
    expect(map.settings.posts).toMatchObject({ idField: 'slug', lists: { recent: ['order'] } })
    expect(map.settings.posts.fields).toContain('order') // blast-radius rows
    record('map baseline', `settings.posts: ${JSON.stringify(map.settings.posts)}`)
  })

  it('POST with a missing/invalid body is a 400 that spells the expected shape', async () => {
    const handler = getHandler('post', '/revalidate-map')
    const noJson = await handler({ payload } as unknown as PayloadRequest)
    expect(noJson.status).toBe(400)

    const badBody = await handler({ payload, json: async () => ({ nope: true }) } as unknown as PayloadRequest)
    expect(badBody.status).toBe(400)
    const body = (await badBody.json()) as { error: string }
    expect(body.error).toBe('Body must be JSON: { "tag": "..." }')

    const unparseable = await handler({
      payload,
      json: async () => {
        throw new Error('bad json')
      },
    } as unknown as PayloadRequest)
    expect(unparseable.status).toBe(400) // swallowed, not a 500
    record('POST bad body', `{"error":"${body.error}"} (400 — also for unparseable JSON)`)
  })

  it('POST with a tag busts it and the map records a manual event', async () => {
    const res = await getHandler('post', '/revalidate-map')({ payload, json: async () => ({ tag: 'posts:42' }) } as unknown as PayloadRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ busted: 'posts:42' })
    const map = await fetchMap()
    const manual = map.events.find((e) => e.source === 'manual')
    expect(manual?.busted).toContainEqual({ tag: 'posts:42', reason: 'manual' })
    record('POST manual bust', '{"busted":"posts:42"}', `event: ${JSON.stringify(manual?.trigger)}`)
  })

  it('GET in a process where the plugin never ran is a 503 saying exactly that (not an empty map)', async () => {
    const slot = globalThis as Record<symbol, unknown>
    const stashed = slot[INSPECT_SLOT]
    delete slot[INSPECT_SLOT]
    try {
      const res = await getHandler('get', '/revalidate-map')({ payload } as unknown as PayloadRequest)
      expect(res.status).toBe(503)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('payload-revalidate is not active in this process')
      record('GET with plugin inactive', `{"error":"${body.error}"} (503)`)
    } finally {
      slot[INSPECT_SLOT] = stashed
    }
  })

  // LAST on purpose: applying the plugin swaps the inspect-slot closure to the observe:false
  // config, which would starve the observation assertions above of their recorded data.
  it('with observe off (the production posture) both endpoints 404 — the map does not leak', async () => {
    const prodConfig = await revalidatePlugin({ observe: false })({ collections: [Posts, Media] } as Config)
    const endpoints = prodConfig.endpoints ?? []
    const get = endpoints.find((e) => e.path === '/revalidate-map' && e.method === 'get')
    const post = endpoints.find((e) => e.path === '/revalidate-map' && e.method === 'post')
    const getRes = await get?.handler({ payload } as unknown as PayloadRequest)
    const postRes = await post?.handler({ payload, json: async () => ({ tag: 'posts:1' }) } as unknown as PayloadRequest)
    expect(getRes?.status).toBe(404)
    expect(postRes?.status).toBe(404)
    expect((await getRes?.json()) as { error: string }).toEqual({ error: 'Not found' })
    record('endpoints with observe off', '{"error":"Not found"} (404, GET and POST both)')
  })
})

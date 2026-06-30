import { seed } from '@pro-laico/payload-seed'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedOptions } from '../src/plugins'
import config from '../src/payload.config'

/** Build a minimal PayloadRequest the transform endpoint understands (id + query + Accept). */
const makeReq = (payload: Payload, id: string, query: string, accept?: string): PayloadRequest =>
  ({
    payload,
    routeParams: { id },
    searchParams: new URLSearchParams(query),
    headers: new Headers(accept ? { accept } : {}),
  }) as unknown as PayloadRequest

const getHandler = (payload: Payload, method: string, path: string) => {
  const ep = payload.config.endpoints.find((e) => e.method === method && e.path === path)
  if (!ep) throw new Error(`endpoint ${method} ${path} not registered`)
  return ep.handler
}

const countVariants = async (payload: Payload, sourceId: string | number): Promise<number> => {
  const r = await payload.find({ collection: 'generated-images', where: { source: { equals: sourceId } }, limit: 100, overrideAccess: true })
  return r.totalDocs
}

/** The endpoint persists the variant AFTER responding (fire-and-forget), so poll for it. */
const waitForVariants = async (payload: Payload, sourceId: string | number, min = 1, tries = 40): Promise<number> => {
  for (let i = 0; i < tries; i++) {
    const n = await countVariants(payload, sourceId)
    if (n >= min) return n
    await new Promise((res) => setTimeout(res, 50))
  }
  return countVariants(payload, sourceId)
}

describe('payload-images wiring', () => {
  let payload: Payload
  let sourceId: string

  beforeAll(async () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    // The sqlite adapter bound DATABASE_URI at config import (the shared `test` file), so
    // clear seeded collections for an idempotent run. db.deleteMany bypasses hooks.
    const req = await createLocalReq({}, payload)
    await payload.db.deleteMany({ collection: 'generated-images', req, where: {} })
    await payload.db.deleteMany({ collection: 'images', req, where: {} })
    await payload.db.deleteMany({ collection: 'pages', req, where: {} })

    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 20, g: 140, b: 90 } } })
      .png()
      .toBuffer()
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'green', focalX: 40, focalY: 60 },
      file: { data: png, mimetype: 'image/png', name: 'green.png', size: png.byteLength },
      overrideAccess: true,
    })
    sourceId = String(doc.id)
  }, 60_000)

  afterAll(async () => {
    await payload?.db?.destroy?.()
  })

  it('registers the images + generated-images collections (under an Assets group)', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    expect(slugs).toEqual(expect.arrayContaining(['images', 'generated-images']))
    const images = payload.config.collections.find((c) => c.slug === 'images')
    const fieldNames = (images?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(fieldNames).toEqual(expect.arrayContaining(['alt', 'variants']))
  })

  it('registers the transform, purge, and seed endpoints', () => {
    const paths = payload.config.endpoints.map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/:id', 'post /img/purge/:id', 'post /seed']))
  })

  it('exposes images as an upload-relationship target', () => {
    const pages = payload.config.collections.find((c) => c.slug === 'pages')
    const hero = (pages?.fields ?? []).find((f) => 'name' in f && f.name === 'heroImage')
    expect(hero).toMatchObject({ type: 'upload', relationTo: 'images' })
  })

  it('400s without a dimension and 404s for an unknown source', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    expect((await handler(makeReq(payload, sourceId, ''))).status).toBe(400)
    expect((await handler(makeReq(payload, 'does-not-exist', 'w=320'))).status).toBe(404)
  })

  it('generates a webp variant on miss (streams bytes + caches a doc) and serves it on hit', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')

    const miss = await handler(makeReq(payload, sourceId, 'w=600&h=600&fit=cover&fmt=webp'))
    expect(miss.status).toBe(200)
    expect(miss.headers.get('Content-Type')).toBe('image/webp')
    // Default images collection is publicly readable → public + edge-cacheable.
    expect(miss.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    const meta = await sharp(Buffer.from(await miss.arrayBuffer())).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(600)
    expect(meta.height).toBe(600)

    expect(await waitForVariants(payload, sourceId, 1)).toBe(1)

    // A second identical request is a cache hit — no new variant created.
    const hit = await handler(makeReq(payload, sourceId, 'w=600&h=600&fit=cover&fmt=webp'))
    expect(hit.status).toBe(200)
    await new Promise((res) => setTimeout(res, 150))
    expect(await countVariants(payload, sourceId)).toBe(1)
  })

  it('negotiates fmt=auto to webp by default and sets Vary', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, sourceId, 'w=320&h=320&fmt=auto', 'image/avif,image/webp,*/*'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Vary')).toBe('Accept')
  })

  it('snaps the requested width to the dimension grid (anti-DoS bound on the variant space)', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, sourceId, 'w=730&fmt=jpeg'))
    expect(res.status).toBe(200)
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(750) // 730 snapped up to the nearest 50px grid point
  })

  it('purges a source’s variants and cascades on delete', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    // Ensure at least one variant exists.
    await handler(makeReq(payload, sourceId, 'w=500&h=500&fit=cover&fmt=webp'))
    await waitForVariants(payload, sourceId, 1)
    expect(await countVariants(payload, sourceId)).toBeGreaterThan(0)

    // Deleting the source removes its variants via the beforeDelete hook.
    await payload.delete({ collection: 'images', id: sourceId, overrideAccess: true })
    expect(await countVariants(payload, sourceId)).toBe(0)
  })

  it('seeds the sample images + page via @pro-laico/payload-seed (native asset flow + focal points)', async () => {
    // The same run the admin "Seed" button / the frontend demo trigger: uploads the three
    // sample photos into `images` (carrying focal points), then a page referencing one.
    const result = await seed({ payload, options: seedOptions })
    expect(result.created.images).toBe(3)
    expect(result.created.pages).toBe(1)

    const imgs = await payload.find({ collection: 'images', limit: 50, overrideAccess: true, sort: 'createdAt' })
    expect(imgs.totalDocs).toBe(3)
    const lighthouse = imgs.docs.find((d) => d.alt === 'Landscape sample') as
      | { id: string | number; focalX?: number; focalY?: number; src?: string; srcset?: string; placeholderURL?: string }
      | undefined
    expect(lighthouse?.focalX).toBe(78)
    expect(lighthouse?.focalY).toBe(32)

    // Virtual URL fields are computed on read and ride along in the API response (absolute, since
    // the sandbox sets serverURL).
    expect(lighthouse?.src).toContain('/api/img/')
    expect(lighthouse?.srcset).toContain('/api/img/')
    expect(lighthouse?.placeholderURL).toContain('w=32')

    // The page resolved its `asset('lighthouse')` token to the uploaded image's id.
    const page = (await payload.find({ collection: 'pages', depth: 0, overrideAccess: true })).docs[0] as
      | { heroImage?: string | number }
      | undefined
    expect(page?.heroImage).toBe(lighthouse?.id)

    // And the transform endpoint renders a seeded image, focal-cropped, end to end.
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, String(lighthouse?.id), 'w=400&h=400&fit=cover&fmt=webp'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(400)
  })
})

import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

/**
 * Nearby-quality fallback, end to end: a cache miss with a same-geometry variant ready serves the
 * stand-in bytes instantly with `Cache-Control: no-store` (nothing may cache it), the exact
 * variant generates in the background, and the next request serves it with the normal immutable
 * headers — the revalidation story in one test.
 */

const makeReq = (payload: Payload, id: string, query: string): PayloadRequest =>
  ({ payload, routeParams: { id }, searchParams: new URLSearchParams(query), headers: new Headers() }) as unknown as PayloadRequest

const transform = (payload: Payload) => {
  const ep = payload.config.endpoints.find((e) => e.method === 'get' && e.path === '/img/:id')
  if (!ep) throw new Error('transform endpoint not registered')
  return ep.handler
}

const countVariants = async (payload: Payload, sourceId: string | number): Promise<number> => {
  const r = await payload.find({ collection: 'generated-images', where: { source: { equals: sourceId } }, limit: 100 })
  return r.totalDocs
}

const waitForVariants = async (payload: Payload, sourceId: string | number, min = 1, tries = 50): Promise<number> => {
  for (let i = 0; i < tries; i++) {
    const n = await countVariants(payload, sourceId)
    if (n >= min) return n
    await new Promise((res) => setTimeout(res, 100))
  }
  return countVariants(payload, sourceId)
}

describe('nearby-quality fallback', () => {
  let payload: Payload
  let sourceId: string

  beforeAll(async () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    const req = await createLocalReq({}, payload)
    for (const collection of ['generated-images', 'image-render-profiles', 'payload-jobs', 'images', 'pages'] as const) {
      await payload.db.deleteMany({ collection, req, where: {} })
    }
    // A wide gradient so a w=1600 request is not clamped by the source.
    const gw = 2000
    const gh = 1125
    const raw = Buffer.alloc(gw * gh * 3)
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const o = (y * gw + x) * 3
        raw[o] = Math.round((x / gw) * 255)
        raw[o + 1] = 120
        raw[o + 2] = Math.round((y / gh) * 255)
      }
    const png = await sharp(raw, { raw: { width: gw, height: gh, channels: 3 } })
      .png()
      .toBuffer()
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'wide' },
      file: { data: png, mimetype: 'image/png', name: 'wide.png', size: png.byteLength },
    })
    sourceId = String(doc.id)
  }, 60_000)

  afterAll(async () => {
    await payload?.db?.destroy?.()
  })

  it('serves a same-geometry stand-in with no-store on a miss, then the exact variant with immutable headers', async () => {
    // 1. Generate one 16:9 variant organically (this is the future stand-in).
    const first = await transform(payload)(makeReq(payload, sourceId, 'w=800&ar=16:9&q=80&fmt=webp'))
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toContain('immutable')
    await waitForVariants(payload, sourceId, 1)

    // 2. Miss at a NEW width, same geometry → the stand-in serves instantly, uncacheable.
    const standIn = await transform(payload)(makeReq(payload, sourceId, 'w=1600&ar=16:9&q=80&fmt=webp'))
    expect(standIn.status).toBe(200)
    expect(standIn.headers.get('cache-control')).toBe('no-store')
    expect(standIn.headers.get('etag')).toBeNull()
    const standInMeta = await sharp(Buffer.from(await standIn.arrayBuffer())).metadata()
    expect(standInMeta.width).toBe(800) // the nearby variant's actual bytes

    // 3. The exact variant generated in the background (void-work path in tests) — poll its row in.
    await waitForVariants(payload, sourceId, 2)

    // 4. Same request again → the accurate image, cached forever. The stand-in never sticks anywhere.
    const exact = await transform(payload)(makeReq(payload, sourceId, 'w=1600&ar=16:9&q=80&fmt=webp'))
    expect(exact.status).toBe(200)
    expect(exact.headers.get('cache-control')).toContain('immutable')
    expect(exact.headers.get('etag')).toBeTruthy()
    const exactMeta = await sharp(Buffer.from(await exact.arrayBuffer())).metadata()
    expect(exactMeta.width).toBe(1600)

    // 5. Exactly two variant rows: the organic one + the exact one — the stand-in was never persisted twice.
    expect(await countVariants(payload, sourceId)).toBe(2)
  })

  it('generates inline when no nearby variant qualifies (different crop geometry)', async () => {
    // Only 16:9 variants exist; a 1:1 request has no same-geometry stand-in → inline generate, immutable.
    const res = await transform(payload)(makeReq(payload, sourceId, 'w=400&ar=1:1&q=80&fmt=webp'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('immutable')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(400)
  })
})

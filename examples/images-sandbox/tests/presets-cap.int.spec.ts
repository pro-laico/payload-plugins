import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

/**
 * Guaranteed presets + the per-image variant cap:
 *   - `?preset=og` resolves the default template to a served variant, exempt from the cap.
 *   - Once a source hits its `variantLimit`, new freeform sizes serve correct bytes but stop
 *     adding `generated-images` rows (deferPersist:'never') — storage bounded.
 */

const makeReq = (payload: Payload, id: string, query: string): PayloadRequest =>
  ({ payload, routeParams: { id }, searchParams: new URLSearchParams(query), headers: new Headers() }) as unknown as PayloadRequest

const transform = (payload: Payload) => {
  const ep = payload.config.endpoints.find((e) => e.method === 'get' && e.path === '/img/:id')
  if (!ep) throw new Error('transform endpoint not registered')
  return ep.handler
}

const countVariants = async (payload: Payload, sourceId: string | number): Promise<number> =>
  (await payload.find({ collection: 'generated-images', where: { source: { equals: sourceId } }, limit: 0 })).totalDocs

/** Poll until the source has at least `n` persisted variants (persist is fire-and-forget). */
const waitForCount = async (payload: Payload, sourceId: string | number, n: number, tries = 50): Promise<number> => {
  for (let i = 0; i < tries; i++) {
    const c = await countVariants(payload, sourceId)
    if (c >= n) return c
    await new Promise((r) => setTimeout(r, 100))
  }
  return countVariants(payload, sourceId)
}

const gradientPng = async (gw: number, gh: number): Promise<Buffer> => {
  const raw = Buffer.alloc(gw * gh * 3)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const o = (y * gw + x) * 3
      raw[o] = Math.round((x / gw) * 255)
      raw[o + 1] = 110
      raw[o + 2] = Math.round((y / gh) * 255)
    }
  return sharp(raw, { raw: { width: gw, height: gh, channels: 3 } })
    .png()
    .toBuffer()
}

describe('presets + variant cap', () => {
  let payload: Payload

  beforeAll(async () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    const req = await createLocalReq({}, payload)
    for (const c of ['generated-images', 'image-render-profiles', 'payload-jobs', 'images', 'pages'] as const) {
      await payload.db.deleteMany({ collection: c, req, where: {} })
    }
  }, 60_000)

  afterAll(async () => {
    await payload?.db?.destroy?.()
  })

  it('serves ?preset=og from the default template and eagerly pre-generates active presets on upload', async () => {
    const png = await gradientPng(2000, 1500)
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'preset', presets: [{ template: 'og' }] },
      file: { data: png, mimetype: 'image/png', name: 'preset.png', size: png.byteLength },
    })
    // Eager generation (afterChange → void work() in tests) creates the og variant — poll for it.
    for (let i = 0; i < 40 && (await countVariants(payload, doc.id)) < 1; i++) await new Promise((r) => setTimeout(r, 100))

    const res = await transform(payload)(makeReq(payload, String(doc.id), 'preset=og'))
    expect(res.status).toBe(200)
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(1200) // the og template's dimensions
    expect(meta.height).toBe(630)

    const unknown = await transform(payload)(makeReq(payload, String(doc.id), 'preset=nope'))
    expect(unknown.status).toBe(404)
  })

  it('caps stored variants: past variantLimit, new sizes serve correct bytes but add no rows', async () => {
    const png = await gradientPng(2000, 1400)
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'capped', variantLimit: 2, presets: [{ template: 'og' }] }, // og toggled on → cap-exempt
      file: { data: png, mimetype: 'image/png', name: 'capped.png', size: png.byteLength },
    })
    // The eager hook pre-generates og on create; clear so the cap test starts from a known count.
    const req0 = await createLocalReq({}, payload)
    await waitForCount(payload, doc.id, 1)
    await payload.db.deleteMany({ collection: 'generated-images', req: req0, where: { source: { equals: doc.id } } })

    const serve = async (q: string) => {
      const res = await transform(payload)(makeReq(payload, String(doc.id), q))
      expect(res.status).toBe(200)
      return sharp(Buffer.from(await res.arrayBuffer())).metadata()
    }
    // Fill the cap (2 distinct sizes), waiting for each persist so the cap state is deterministic.
    await serve('w=400&ar=16:9&fmt=webp')
    await waitForCount(payload, doc.id, 1)
    await serve('w=800&ar=16:9&fmt=webp')
    const atCap = await waitForCount(payload, doc.id, 2)
    expect(atCap).toBe(2)

    // A NEW geometry with no fallback candidate, past the cap: generated at the requested size but
    // NOT persisted (deferPersist:'never') — correct bytes, storage stays flat.
    const fresh = await serve('w=500&ar=1:1&fmt=webp')
    expect(fresh.width).toBe(500)
    expect(fresh.height).toBe(500)
    await new Promise((r) => setTimeout(r, 400))
    expect(await countVariants(payload, doc.id)).toBe(atCap) // no growth past the cap

    // …but a preset is exempt and still generates + persists.
    await transform(payload)(makeReq(payload, String(doc.id), 'preset=og'))
    expect(await waitForCount(payload, doc.id, atCap + 1)).toBeGreaterThan(atCap) // preset bypassed the cap
  })
})

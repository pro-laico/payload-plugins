import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

/**
 * Smart prewarm, end to end: serve a declared render through the transform endpoint → the
 * recorder learns the profile (IMAGES_PREWARM_FLUSH_MS=100 in the test script makes the buffered
 * flush near-immediate) → run the imagesPrewarm job for a FRESH image → its expected variants
 * exist before anything ever requested them → a focal edit re-enqueues.
 */

// Accept webp like a real browser — with no Accept header fmt=auto negotiates to jpeg, which the
// prewarm (defaultFormats: ['webp']) never generates, so every "warmed" serve would silently miss.
const makeReq = (payload: Payload, id: string, query: string): PayloadRequest =>
  ({
    payload,
    routeParams: { id },
    searchParams: new URLSearchParams(query),
    headers: new Headers({ accept: 'image/webp' }),
  }) as unknown as PayloadRequest

const transform = (payload: Payload) => {
  const ep = payload.config.endpoints.find((e) => e.method === 'get' && e.path === '/img/:id')
  if (!ep) throw new Error('transform endpoint not registered')
  return ep.handler
}

const gradientPng = async (gw: number, gh: number): Promise<Buffer> => {
  const raw = Buffer.alloc(gw * gh * 3)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const o = (y * gw + x) * 3
      raw[o] = Math.round((x / gw) * 255)
      raw[o + 1] = 90
      raw[o + 2] = Math.round((y / gh) * 255)
    }
  return sharp(raw, { raw: { width: gw, height: gh, channels: 3 } })
    .png()
    .toBuffer()
}

const poll = async <T>(fn: () => Promise<T | undefined>, tries = 50): Promise<T | undefined> => {
  for (let i = 0; i < tries; i++) {
    const v = await fn()
    if (v !== undefined) return v
    await new Promise((r) => setTimeout(r, 100))
  }
  return undefined
}

/** The endpoint persists variants AFTER responding (fire-and-forget under vitest) — wait for any
 * in-flight persist to land so counts are trustworthy and nothing races db teardown. */
const drainPersists = async (payload: Payload): Promise<number> => {
  let settled = (await payload.count({ collection: 'generated-images' })).totalDocs
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100))
    const now = (await payload.count({ collection: 'generated-images' })).totalDocs
    if (now === settled) break
    settled = now
  }
  return settled
}

describe('smart prewarm', () => {
  let payload: Payload
  let observedId: string
  let freshId: string

  beforeAll(async () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    const req = await createLocalReq({}, payload)
    for (const collection of ['generated-images', 'image-render-profiles', 'payload-jobs', 'images', 'pages'] as const) {
      await payload.db.deleteMany({ collection, req, where: {} })
    }
    const png = await gradientPng(1200, 800)
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'observed' },
      file: { data: png, mimetype: 'image/png', name: 'observed.png', size: png.byteLength },
    })
    observedId = String(doc.id)
  }, 60_000)

  afterAll(async () => {
    // Let any floating persist land before tearing the db down under it.
    if (payload) await drainPersists(payload)
    await payload?.db?.destroy?.()
  })

  it('learns a served render as a profile doc (ratio classified, width histogrammed)', async () => {
    // Serve a declared 16:9 render at two widths where the snap grid distinguishes 16:9 from the
    // source's natural 3:2 (at small widths both ratios can snap to the same height — the
    // observation then files under `natural`, which warms the identical (w,h) variant anyway).
    for (const q of ['w=800&ar=16:9&q=80', 'w=600&ar=16:9&q=80']) {
      const res = await transform(payload)(makeReq(payload, observedId, q))
      expect(res.status).toBe(200)
    }
    // Poll until BOTH widths landed — the recorder may flush between the two serves.
    const profile = await poll(async () => {
      const r = await payload.find({ collection: 'image-render-profiles', where: { profileKey: { equals: '1.778|cover|80|auto' } }, limit: 1 })
      const doc = r.docs[0] as { widths?: Record<string, { n: number }> } | undefined
      return doc?.widths?.['800'] && doc.widths['600'] ? doc : undefined
    })
    expect(profile, 'profile doc should be flushed by the recorder with both observed widths').toBeDefined()
    expect(profile?.widths?.['800']?.n).toBe(1)
    expect(profile?.widths?.['600']?.n).toBe(1)
  })

  it('prewarms a FRESH image against the learned profile before anything requests it', async () => {
    const png = await gradientPng(1000, 700)
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'fresh' },
      file: { data: png, mimetype: 'image/png', name: 'fresh.png', size: png.byteLength },
    })
    freshId = String(doc.id)
    // The create hook queued a job with a 30s waitUntil; queue an immediately-eligible one instead.
    await payload.jobs.queue({
      task: 'imagesPrewarm',
      input: { sourceId: String(doc.id), reason: 'manual' },
    } as never) //EXCUSE: TypedJobs task slugs are generated per-app; this test app has none, so the union degenerates

    await payload.jobs.run({ limit: 10 })

    const variants = await payload.find({ collection: 'generated-images', where: { source: { equals: doc.id } }, limit: 100 })
    // Built-ins (src/thumbnail/placeholder) + the learned 16:9 q80 profile at its observed widths.
    expect(variants.totalDocs).toBeGreaterThanOrEqual(5)
    const q80 = variants.docs.filter((v) => (v as { quality?: number }).quality === 80)
    expect(q80.length).toBeGreaterThanOrEqual(2)

    // The warm was exact: serving the learned render now is a pure cache hit (no new variant row).
    // Drain deferred persists before comparing — a miss persists AFTER responding, so an immediate
    // re-count would equal `before` even when the serve actually generated a fresh variant.
    const before = variants.totalDocs
    const res = await transform(payload)(makeReq(payload, String(doc.id), 'w=800&ar=16:9&q=80'))
    expect(res.status).toBe(200)
    await drainPersists(payload)
    const after = await payload.find({ collection: 'generated-images', where: { source: { equals: doc.id } }, limit: 100 })
    expect(after.totalDocs).toBe(before)
  })

  it('warmed the exact src URL and the every-5th width skeleton the default strategy derives', async () => {
    // The default strategy's promise on the 50px-grid default: the src render (NO derived h) plus
    // a skeleton of every 5th reachable width are warm; the fallback bridges in-between srcset
    // widths from a warm neighbor.
    const doc = (await payload.findByID({ collection: 'images', id: freshId })) as { src?: string }
    expect(doc.src).toBeTruthy()
    const srcQuery = new URL(doc.src ?? '', 'http://local').search.slice(1)

    const before = await drainPersists(payload)
    const res = await transform(payload)(makeReq(payload, freshId, srcQuery))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).not.toContain('no-store') // a stand-in fallback would be no-store
    await drainPersists(payload)
    const after = (await payload.count({ collection: 'generated-images' })).totalDocs
    expect(after, 'the src render should already be cached').toBe(before)

    // The default 1:1 q80 seed warms the every-5th skeleton ≤ the 1000px source (1000, 750, 500,
    // 250) — but a square crop of a 1000×700 source never upscales past 700×700, so the 750 and
    // 1000 targets both land as 700-wide squares (distinct cache keys, same rendered size).
    const rows = await payload.find({
      collection: 'generated-images',
      where: { and: [{ source: { equals: freshId } }, { quality: { equals: 80 } }] },
      limit: 100,
      depth: 0,
    })
    const widths = new Set(rows.docs.map((v) => (v as { width?: number }).width))
    for (const w of [250, 500, 700]) expect(widths, `skeleton width ${w} should be warm`).toContain(w)
  })

  it('re-enqueues on a focal edit (the purge trigger set)', async () => {
    // Clear the pending create-time job first — a pending un-started job DEDUPES further
    // enqueues (it recomputes from current state when it runs, so it already covers the edit).
    const req = await createLocalReq({}, payload)
    await payload.db.deleteMany({ collection: 'payload-jobs', req, where: {} })
    await payload.update({ collection: 'images', id: observedId, data: { focalX: 20, focalY: 30 } })
    const job = await poll(async () => {
      const r = await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'imagesPrewarm' } }, limit: 100 })
      return r.docs.find((d) => {
        const input = (d as { input?: { sourceId?: string; reason?: string } }).input
        return input?.sourceId === observedId && input?.reason === 'focal'
      })
    }, 10)
    expect(job, 'a focal-reason prewarm job should be pending').toBeDefined()
  })
})

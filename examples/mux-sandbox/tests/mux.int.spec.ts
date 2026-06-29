import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { ingestMuxAsset, ingestMuxVideo, muxAssetProvider } from '@pro-laico/payload-mux'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

// Test webhook secret. Provided via the `test` script's env (MUX_WEBHOOK_SECRET) so it's set
// before payload.config is imported and the plugin's Mux client reads it at construction. The
// webhook never reaches localhost from Mux, so we sign payloads ourselves with Mux's exact
// scheme and drive the handler directly.
const WEBHOOK_SECRET = process.env.MUX_WEBHOOK_SECRET ?? 'whsec_test_payload_mux'

/** Reproduce Mux's `mux-signature` header: HMAC-SHA256 over `${t}.${rawBody}`, hex. */
function muxSignature(body: unknown, secret: string): string {
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', secret)
    .update(`${t}.${JSON.stringify(body)}`)
    .digest('hex')
  return `t=${t},v1=${v1}`
}

describe('payload-mux wiring', () => {
  let payload: Payload
  let dbDir: string

  /** Call the registered POST /mux/webhook handler with a hand-built request. */
  const callWebhook = (body: unknown, signature?: string) => {
    const endpoint = payload.config.endpoints.find((e) => e.method === 'post' && e.path === '/mux/webhook')
    if (!endpoint) throw new Error('webhook endpoint not registered')
    const req = { payload, json: async () => body, headers: new Headers(signature ? { 'mux-signature': signature } : {}) }
    return endpoint.handler(req as never)
  }

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'mux-sandbox-'))
    process.env.DATABASE_URI = `file:${join(dbDir, 'test.db')}`
    process.env.PAYLOAD_SECRET = 'test-secret'
    // MUX_WEBHOOK_SECRET comes from the test script env (set before this module imported the
    // config). Token id/secret stay unset — new Mux() boots fine without them.
    payload = await getPayload({ config })
    // The sqlite adapter binds DATABASE_URI at config import (before this hook), so the db is
    // the shared file from the `test` script — clear seeded collections so the run is
    // idempotent. db.deleteMany bypasses hooks, so no Mux call is attempted for fake assetIds.
    const req = await createLocalReq({}, payload)
    await payload.db.deleteMany({ collection: 'mux-video', req, where: {} })
    await payload.db.deleteMany({ collection: 'pages', req, where: {} })
  })

  afterAll(async () => {
    await payload?.db?.destroy?.()
    if (dbDir) rmSync(dirname(join(dbDir, 'test.db')), { recursive: true, force: true })
  })

  it('registers the mux-video collection with the expected fields', () => {
    const collection = payload.config.collections.find((c) => c.slug === 'mux-video')
    expect(collection).toBeDefined()
    const fieldNames = (collection?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(fieldNames).toEqual(expect.arrayContaining(['muxUploader', 'source', 'title', 'assetId', 'duration', 'playbackOptions']))
  })

  it('registers the upload, webhook, and seed endpoints', () => {
    const paths = payload.config.endpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['POST /mux/upload', 'GET /mux/upload', 'POST /mux/webhook', 'POST /seed']))
  })

  it('exposes mux-video as a relationship target', () => {
    const pages = payload.config.collections.find((c) => c.slug === 'pages')
    const heroVideo = (pages?.fields ?? []).find((f) => 'name' in f && f.name === 'heroVideo')
    expect(heroVideo).toMatchObject({ type: 'relationship', relationTo: 'mux-video' })
  })

  it('exposes the server-side ingest API and the seed asset provider', () => {
    expect(typeof ingestMuxVideo).toBe('function')
    expect(typeof ingestMuxAsset).toBe('function')
    expect(muxAssetProvider()).toEqual({ token: 'video', collection: 'mux-video', sourceDir: 'video' })
    expect(muxAssetProvider({ sourceDir: 'videos' }).sourceDir).toBe('videos')
  })

  it('stashes plugin options on config.custom (so tooling can build a Mux client from payload)', () => {
    const stashed = (payload.config.custom as { payloadMux?: { options?: unknown } }).payloadMux
    expect(stashed?.options).toBeDefined()
  })

  // Pre-resolved data (assetId + playbackOptions) makes the hooks skip Mux, so we can create a
  // target doc without a real asset.
  const seedDoc = (assetId: string, duration: number) =>
    payload.create({
      collection: 'mux-video',
      data: { title: `wh-${assetId}`, assetId, duration, playbackOptions: [{ playbackId: `pb-${assetId}`, playbackPolicy: 'public' }] },
      overrideAccess: true,
    })

  it('verifies a correctly-signed webhook and applies the update', async () => {
    const doc = await seedDoc('asset_wh_ok', 1)
    const body = {
      type: 'video.asset.updated',
      object: { id: 'asset_wh_ok', type: 'asset' },
      data: { id: 'asset_wh_ok', duration: 99, aspect_ratio: '16:9', playback_ids: [{ id: 'pb-asset_wh_ok', policy: 'public' }] },
    }
    const res = await callWebhook(body, muxSignature(body, WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const updated = await payload.findByID({ collection: 'mux-video', id: doc.id })
    expect(updated.duration).toBe(99)
    expect(updated.aspectRatio).toBe('16/9')
  })

  it('rejects a webhook signed with the wrong secret (401) and leaves the doc unchanged', async () => {
    const doc = await seedDoc('asset_wh_bad', 5)
    const body = {
      type: 'video.asset.updated',
      object: { id: 'asset_wh_bad' },
      data: { id: 'asset_wh_bad', duration: 999, aspect_ratio: '1:1' },
    }
    const res = await callWebhook(body, muxSignature(body, 'the-wrong-secret'))
    expect(res.status).toBe(401)
    const after = await payload.findByID({ collection: 'mux-video', id: doc.id })
    expect(after.duration).toBe(5)
  })

  it('rejects a webhook with no signature header (401)', async () => {
    const res = await callWebhook({ type: 'video.asset.updated', object: { id: 'nope' }, data: {} })
    expect(res.status).toBe(401)
  })
})

import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import Mux from '@mux/mux-node'
import { ingestMuxVideo } from '@pro-laico/payload-mux'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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

  it('exposes the server-side ingest API and marks mux-video as a seed asset collection', () => {
    expect(typeof ingestMuxVideo).toBe('function')
    const muxVideo = payload.config.collections.find((c) => c.slug === 'mux-video')
    expect(muxVideo?.custom?.seedAsset).toEqual({ sourceField: 'source' })
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

  // A doc is left `preparing` whenever the upload hook's short poll times out and the
  // `video.asset.ready` webhook never lands (bad secret, downtime, wrong URL). Recovery has to be
  // something an editor can do from the admin — i.e. a plain save.
  describe('healing a doc stuck in `preparing`', () => {
    // The plugin builds its own Mux client, so reach it via the shared Assets prototype rather
    // than the (unexported) instance. Same prototype object, so the plugin's client sees the stub.
    const assetsProto = () => Object.getPrototypeOf(new Mux({ tokenId: 't', tokenSecret: 's' }).video.assets)

    const stubRetrieve = (impl: (id: string) => unknown) =>
      vi.spyOn(assetsProto(), 'retrieve').mockImplementation((id: unknown) => Promise.resolve(impl(id as string)))

    const readyAsset = (id: string) => ({
      id,
      status: 'ready',
      duration: 12.5,
      aspect_ratio: '16:9',
      playback_ids: [{ id: `pb-${id}`, policy: 'public' }],
      tracks: [{ type: 'video', max_width: 1920, max_height: 1080 }],
    })

    /** Seed at the db layer — payload.create would call Mux via the assetId hook. */
    const seedStuck = (assetId: string) =>
      payload.db.create({ collection: 'mux-video', data: { title: `stuck-${assetId}`, assetId, status: 'preparing' } })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('re-saving refetches from Mux and marks it ready', async () => {
      const doc = (await seedStuck('asset_stuck')) as unknown as { id: string | number }
      const retrieve = stubRetrieve(readyAsset)

      const saved = (await payload.update({
        collection: 'mux-video',
        id: doc.id,
        data: { title: 'stuck-asset_stuck' },
      })) as unknown as { status?: string; duration?: number; aspectRatio?: string; playbackOptions?: unknown[] }

      expect(retrieve).toHaveBeenCalledWith('asset_stuck')
      expect(saved.status).toBe('ready')
      expect(saved.playbackOptions).toHaveLength(1)
      expect(saved.aspectRatio).toBe('16/9')
      expect(saved.duration).toBe(12.5)
    })

    it('marks it errored (without deleting the asset) when Mux reports errored', async () => {
      const doc = (await seedStuck('asset_broken')) as unknown as { id: string | number }
      const del = vi.spyOn(assetsProto(), 'delete')
      stubRetrieve((id) => ({ id, status: 'errored', errors: { type: 'invalid_input', messages: ['Input file is corrupt'] } }))

      const saved = (await payload.update({ collection: 'mux-video', id: doc.id, data: { title: 'stuck-asset_broken' } })) as unknown as {
        status?: string
        error?: string
      }

      expect(saved.status).toBe('errored')
      expect(saved.error).toContain('Input file is corrupt')
      expect(del).not.toHaveBeenCalled() // an existing doc's asset is never destroyed by a save
    })

    // A `ready` asset with no playback policy has nothing to play. Marking it ready anyway would
    // also re-arm the heal on every future save, since the fast path needs playbackOptions.
    it('leaves a ready-but-playback-less asset preparing rather than marking it ready', async () => {
      const doc = (await seedStuck('asset_no_playback')) as unknown as { id: string | number }
      stubRetrieve((id) => ({ id, status: 'ready', duration: 4, playback_ids: [] }))

      const saved = (await payload.update({ collection: 'mux-video', id: doc.id, data: { title: 'stuck-asset_no_playback' } })) as unknown as {
        status?: string
        playbackOptions?: unknown[]
      }

      expect(saved.status).toBe('preparing')
      expect(saved.playbackOptions ?? []).toHaveLength(0)
    })

    it('still saves when Mux is unreachable, leaving the doc as-is', async () => {
      const doc = (await seedStuck('asset_offline')) as unknown as { id: string | number }
      vi.spyOn(assetsProto(), 'retrieve').mockRejectedValue(new Error('Mux is down'))

      const saved = (await payload.update({ collection: 'mux-video', id: doc.id, data: { title: 'renamed-while-mux-down' } })) as unknown as {
        title?: string
        status?: string
      }

      expect(saved.title).toBe('renamed-while-mux-down') // healing is best-effort; it must not block the edit
      expect(saved.status).toBe('preparing')
    })

    it('does not call Mux when saving an already-ready doc', async () => {
      const doc = await seedDoc('asset_already_ready', 3)
      const retrieve = stubRetrieve(readyAsset)

      await payload.update({ collection: 'mux-video', id: doc.id, data: { title: 'wh-asset_already_ready renamed' } })

      expect(retrieve).not.toHaveBeenCalled()
    })
  })
})

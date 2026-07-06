import { createHmac } from 'node:crypto'
import { muxVideoPlugin } from '@pro-laico/payload-mux'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootLab, expectBootError, type LabBoot } from '@/boot'
import { clearLogs, logs } from '@/logCapture'
import { createReport } from './report'

// payload-mux failure paths WITHOUT credentials/network. The Mux SDK defers its auth error to
// request-prep time ("Could not resolve authentication method…"), so every path that would call
// Mux fails fast and offline — and the plugin wraps it with the doc, the source, and the fix.
// Config-time warnings use console.warn (NOT payload.logger), so they need a spy, not the capture.

const record = createReport('payload-mux')

const WEBHOOK_SECRET = 'whsec_failure_lab'

let lab: LabBoot
let payload: Payload
let bootWarns: string[] = []

const errorMessages = (): string[] => logs.filter((l) => l.level === 50).map((l) => l.msg)

const getHandler = (method: string, path: string) => {
  const ep = payload.config.endpoints.find((e) => e.method === method && e.path === path)
  if (!ep) throw new Error(`endpoint ${method} ${path} not registered — paths: ${payload.config.endpoints.map((e) => e.path).join(', ')}`)
  return ep.handler
}

/** Mux's `mux-signature` header: HMAC-SHA256 over `${t}.${rawBody}`, hex. */
const muxSignature = (body: unknown, secret: string): string => {
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', secret)
    .update(`${t}.${JSON.stringify(body)}`)
    .digest('hex')
  return `t=${t},v1=${v1}`
}

const callWebhook = (body: unknown, signature?: string) =>
  getHandler(
    'post',
    '/mux/webhook',
  )({ payload, json: async () => body, headers: new Headers(signature ? { 'mux-signature': signature } : {}) } as unknown as PayloadRequest)

beforeAll(async () => {
  // The whole point: boot with NO Mux credentials.
  delete process.env.MUX_TOKEN_ID
  delete process.env.MUX_TOKEN_SECRET
  process.env.MUX_WEBHOOK_SECRET = WEBHOOK_SECRET

  // The missing-creds warning is console.warn at plugin-apply time — capture it around the boot.
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    lab = await bootLab({ plugins: [muxVideoPlugin()] })
    bootWarns = spy.mock.calls.map((c) => c.join(' '))
  } finally {
    spy.mockRestore()
  }
  payload = lab.payload
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
})

describe('boot without credentials', () => {
  it('warns at config time and marks the collection custom.seedDisabled with the reason', () => {
    const warn = bootWarns.find((w) => w.includes('[payload-mux]'))
    expect(warn).toContain('MUX_TOKEN_ID / MUX_TOKEN_SECRET not set')
    const coll = payload.config.collections.find((c) => c.slug === 'mux-video')
    expect(coll?.custom?.seedDisabled).toBe('Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)')
    record('boot with no creds', warn, `custom.seedDisabled: ${String(coll?.custom?.seedDisabled)}`)
  })

  it("extendCollection pointing at a collection that doesn't exist throws a named error", async () => {
    const e = await expectBootError([muxVideoPlugin({ extendCollection: 'nope' })])
    expect(e.message).toContain("[payload-mux] extendCollection: collection 'nope' not found")
    record('extendCollection → unknown collection', e.message)
  })
})

describe('local-API writes without credentials', () => {
  it('a bare doc (no source, no assetId) still saves — the clean baseline', async () => {
    const doc = (await payload.create({
      collection: 'mux-video' as never,
      data: { title: 'No Media Yet' } as never,
      overrideAccess: true,
    })) as unknown as {
      id: string | number
    }
    expect(doc.id).toBeTruthy()
  })

  it('creating with a `source` rejects NAMING the doc, the source, and the missing-creds fix', async () => {
    clearLogs()
    const err = await payload
      .create({
        collection: 'mux-video' as never,
        data: { title: 'Ingest Me', source: { file: 'assets/media/ok.txt' } } as never,
        overrideAccess: true,
      })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(err?.message).toContain("[payload-mux] ingest failed for 'Ingest Me'")
    expect(err?.message).toContain('source: assets/media/ok.txt')
    expect(err?.message).toContain('MUX_TOKEN_ID / MUX_TOKEN_SECRET') // the actionable fix
    expect(errorMessages().some((m) => m.includes("ingest failed for 'Ingest Me'"))).toBe(true) // logged too
    record('create with source, no creds', err?.message)
  })

  it('creating with an `assetId` rejects raw too, but the LOG carries the [payload-mux] context', async () => {
    clearLogs()
    const err = await payload
      .create({ collection: 'mux-video' as never, data: { title: 'Fetch Me', assetId: 'fake-asset' } as never, overrideAccess: true })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(err?.message).toContain('Could not resolve authentication method')
    const logged = errorMessages().find((m) => m.includes('[payload-mux]'))
    expect(logged).toContain("Error preparing Mux asset for 'Fetch Me'") // names the doc — log-only
    record('create with assetId, no creds', `thrown: ${err?.message.slice(0, 100)}…`, `logged: ${logged}`)
  })
})

describe('endpoint failures', () => {
  it('POST /mux/upload: 403 unauthenticated; authed with no creds a clean, logged 500', async () => {
    clearLogs()
    const handler = getHandler('post', '/mux/upload')
    const anon = await handler({ payload, user: null } as unknown as PayloadRequest)
    expect(anon.status).toBe(403)
    expect(await anon.json()).toEqual({ error: 'Forbidden.' })

    const authed = await handler({ payload, user: { id: 1, collection: 'users' } } as unknown as PayloadRequest)
    expect(authed.status).toBe(500) // previously an UNCAUGHT SDK error → Payload's generic 500
    expect(await authed.json()).toEqual({ error: 'Failed to create upload.' })
    expect(errorMessages().some((m) => m.includes('[payload-mux] Failed to create upload'))).toBe(true)
    record('create-upload endpoint', '{"error":"Forbidden."} (403)', '{"error":"Failed to create upload."} (500, logged)')
  })

  it('GET /mux/upload without an id is a clean 400; with an id but no creds a logged 500', async () => {
    clearLogs()
    const handler = getHandler('get', '/mux/upload')
    const user = { id: 1, collection: 'users' } // the default gate checks user.collection === admin.user
    const noId = await handler({ payload, user, query: {} } as unknown as PayloadRequest)
    expect(noId.status).toBe(400)
    expect(await noId.json()).toEqual({ error: 'Missing upload id.' })

    const withId = await handler({ payload, user, query: { id: 'upl_123' } } as unknown as PayloadRequest)
    expect(withId.status).toBe(500)
    expect(await withId.json()).toEqual({ error: 'Failed to retrieve upload.' })
    const logged = errorMessages().find((m) => m.includes('[payload-mux]'))
    expect(logged).toContain("Failed to retrieve upload 'upl_123'")
    record('upload status endpoint', '{"error":"Missing upload id."}', '{"error":"Failed to retrieve upload."} (500)', logged)
  })

  it('a webhook with no/bad signature is a 401 with an actionable hint', async () => {
    clearLogs()
    const unsigned = await callWebhook({ type: 'video.asset.ready', data: { id: 'x' } })
    expect(unsigned.status).toBe(401)
    const body = (await unsigned.json()) as { error: string }
    expect(body.error).toContain('signature')
    const logged = errorMessages().find((m) => m.includes('[payload-mux]'))
    expect(logged).toContain('MUX_WEBHOOK_SECRET') // tells the operator exactly what to check
    record('webhook bad signature', `body: ${JSON.stringify(body)}`, logged)
  })

  it("a signed video.asset.errored event lands Mux's error message on the doc", async () => {
    // Seed the doc at the db layer (payload.create would call Mux via the assetId hook).
    await payload.db.create({
      collection: 'mux-video',
      data: { title: 'Doomed Upload', assetId: 'asset_errored_1', status: 'preparing' },
    })
    const event = {
      type: 'video.asset.errored',
      object: { type: 'asset', id: 'asset_errored_1' },
      data: { id: 'asset_errored_1', errors: { type: 'invalid_input', messages: ['Input file is corrupt or unsupported'] } },
    }
    const res = await callWebhook(event, muxSignature(event, WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    const doc = (
      await payload.find({ collection: 'mux-video' as never, where: { assetId: { equals: 'asset_errored_1' } } as never, overrideAccess: true })
    ).docs[0] as unknown as { status?: string; error?: string }
    expect(doc?.status).toBe('errored')
    expect(doc?.error).toContain('Input file is corrupt or unsupported')
    record('signed asset.errored webhook', `doc.status: ${doc?.status}`, `doc.error: ${doc?.error}`)
  })
})

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

// Boot the real config (with dummy Mux credentials) against a throwaway SQLite DB and assert
// the plugin wired itself in. Assertions are static (no network calls to Mux) — this checks
// the Payload surface the plugin registers and that it sanitizes into a valid config, the
// automated analog of "does the admin panel show a Videos collection".
describe('payload-mux wiring', () => {
  let payload: Payload
  let dbDir: string

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'mux-sandbox-'))
    process.env.DATABASE_URI = `file:${join(dbDir, 'test.db')}`
    process.env.PAYLOAD_SECRET = 'test-secret'
    process.env.MUX_TOKEN_ID ||= 'test'
    process.env.MUX_TOKEN_SECRET ||= 'test'
    process.env.MUX_WEBHOOK_SIGNING_SECRET ||= 'test'
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    await payload?.db?.destroy?.()
    if (dbDir) rmSync(dirname(join(dbDir, 'test.db')), { recursive: true, force: true })
  })

  it('registers the mux-video collection with the expected fields', () => {
    const collection = payload.config.collections.find((c) => c.slug === 'mux-video')
    expect(collection).toBeDefined()
    const fieldNames = (collection?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(fieldNames).toEqual(expect.arrayContaining(['muxUploader', 'title', 'assetId', 'duration', 'playbackOptions']))
  })

  it('registers the upload and webhook endpoints', () => {
    const paths = payload.config.endpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['POST /mux/upload', 'GET /mux/upload', 'POST /mux/webhook']))
  })

  it('exposes mux-video as a relationship target', () => {
    const pages = payload.config.collections.find((c) => c.slug === 'pages')
    const heroVideo = (pages?.fields ?? []).find((f) => 'name' in f && f.name === 'heroVideo')
    expect(heroVideo).toMatchObject({ type: 'relationship', relationTo: 'mux-video' })
  })
})

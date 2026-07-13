import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { imagesPlugin } from '@pro-laico/payload-images'
import type { Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootLab, expectBootError, type LabBoot } from '@/boot'
import { clearLogs, logs, warnMessages } from '@/logCapture'
import { createReport } from './report'

// payload-images failure paths: boot-time config guards, transform-endpoint 4xx/5xx bodies, and
// the logger lines that carry the ACTUAL diagnosis (the client bodies are deliberately terse —
// 'Source unavailable' / 'Transform failed' — so legibility lives in the log; assert both).

const record = createReport('payload-images')

let lab: LabBoot
let payload: Payload

/** Minimal PayloadRequest for the transform endpoint (id + query + Accept). */
const makeReq = (id: string, query: string, accept?: string): PayloadRequest =>
  ({
    payload,
    routeParams: { id },
    searchParams: new URLSearchParams(query),
    headers: new Headers(accept ? { accept } : {}),
  }) as unknown as PayloadRequest

const getHandler = (method: string, path: string) => {
  const ep = payload.config.endpoints.find((e) => e.method === method && e.path === path)
  if (!ep) throw new Error(`endpoint ${method} ${path} not registered — paths: ${payload.config.endpoints.map((e) => e.path).join(', ')}`)
  return ep.handler
}

const errorMessages = (): string[] => logs.filter((l) => l.level === 50).map((l) => l.msg)

let goneId: string // source doc whose file is deleted from disk
let corruptId: string // source doc whose file is overwritten with garbage

beforeAll(async () => {
  await rm('images', { recursive: true, force: true }) // default staticDir under cwd
  await rm('generated-images', { recursive: true, force: true })
  lab = await bootLab({ plugins: [imagesPlugin()], sharp })
  payload = lab.payload

  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png()
    .toBuffer()
  const mk = async (name: string) =>
    (await payload.create({
      collection: 'images' as never,
      data: { alt: name } as never,
      file: { data: png, mimetype: 'image/png', name, size: png.byteLength },
      overrideAccess: true,
    })) as unknown as { id: string | number; filename: string }

  const gone = await mk('gone.png')
  goneId = String(gone.id)
  await rm(join('images', gone.filename), { force: true }) // bytes vanish; doc remains

  const corrupt = await mk('corrupt.png')
  corruptId = String(corrupt.id)
  await writeFile(join('images', corrupt.filename), 'not an image at all') // undecodable bytes
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
  await rm('images', { recursive: true, force: true })
  await rm('generated-images', { recursive: true, force: true })
})

describe('boot-time config guards (thrown from buildConfig)', () => {
  it("extendCollection pointing at a collection that doesn't exist throws a named error", async () => {
    const e = await expectBootError([imagesPlugin({ extendCollection: 'nope' })])
    expect(e.message).toContain("[payload-images] extendCollection: collection 'nope' not found")
    record('extendCollection → unknown collection', e.message)
  })

  it('extendCollection pointing at a NON-upload collection throws a named error', async () => {
    const e = await expectBootError(
      [imagesPlugin({ extendCollection: 'posts' })],
      [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
    )
    expect(e.message).toContain("[payload-images] extendCollection: collection 'posts' is not an upload collection")
    record('extendCollection → non-upload collection', e.message)
  })
})

describe('boot-time warnings (logged, not thrown)', () => {
  it('transform: false + virtualFields: true warns that the URL fields will 404', async () => {
    clearLogs()
    const b = await bootLab({ plugins: [imagesPlugin({ transform: false, virtualFields: true })] })
    const warn = warnMessages().find((w) => w.includes('[payload-images]'))
    await b.cleanup()
    expect(warn).toContain('virtualFields: true with transform: false')
    expect(warn).toContain('will 404')
    record('virtualFields without the transform endpoint', warn)
  })

  it("a collection named 'img' shadows the transform route — warned at boot", async () => {
    clearLogs()
    const b = await bootLab({
      plugins: [imagesPlugin()],
      collections: [{ slug: 'img', fields: [{ name: 'title', type: 'text' }] }],
    })
    const warn = warnMessages().find((w) => w.includes('shadows the transform endpoint'))
    await b.cleanup()
    expect(warn).toContain('"img"')
    record("collection slug 'img' shadows /api/img", warn)
  })
})

describe('transform endpoint failures (handlers called directly — no Next server)', () => {
  it('400s: missing id / invalid w / no dimension — terse but identifiable bodies', async () => {
    const handler = getHandler('get', '/img/:id')
    const noId = await handler(makeReq('', 'w=320'))
    const badW = await handler(makeReq(goneId, 'w=0'))
    const noDim = await handler(makeReq(goneId, ''))
    expect(noId.status).toBe(400)
    expect(await noId.text()).toBe('Missing target collections id')
    expect(badW.status).toBe(400)
    expect(await badW.text()).toBe('invalid w')
    expect(noDim.status).toBe(400)
    expect(await noDim.text()).toBe('width or height required')
    record('transform 400s', 'Missing target collections id', 'invalid w', 'width or height required')
  })

  it('404s for an unknown source id', async () => {
    const res = await getHandler('get', '/img/:id')(makeReq('does-not-exist', 'w=64'))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
    record('transform 404', 'Not found')
  })

  it('502 Source unavailable when the bytes are gone — the WHY lives in the log, with the id', async () => {
    clearLogs()
    const res = await getHandler('get', '/img/:id')(makeReq(goneId, 'w=64'))
    expect(res.status).toBe(502)
    expect(await res.text()).toBe('Source unavailable') // client body: opaque by design
    const warn = warnMessages().find((w) => w.includes('unreadable'))
    expect(warn).toContain(goneId) // the log names the source id + filename
    expect(warn).toContain('gone.png')
    record('source bytes unreadable (502)', 'client body: Source unavailable', warn)
  })

  it('500 Transform failed on undecodable bytes — the log names the id and the sharp error', async () => {
    clearLogs()
    const res = await getHandler('get', '/img/:id')(makeReq(corruptId, 'w=64'))
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Transform failed') // client body: opaque by design
    const err = errorMessages().find((m) => m.includes('transform failed'))
    expect(err).toContain(corruptId)
    record('corrupt source bytes (500)', 'client body: Transform failed', err)
  })
})

describe('purge endpoint failures', () => {
  it('401s without a user, 400s without an id', async () => {
    const handler = getHandler('post', '/img/purge/:id')
    const anon = await handler({ payload, user: null, routeParams: { id: goneId } } as unknown as PayloadRequest)
    expect(anon.status).toBe(401)
    expect(await anon.json()).toEqual({ error: 'Unauthorized' })
    const noId = await handler({ payload, user: { id: 1 }, routeParams: {} } as unknown as PayloadRequest)
    expect(noId.status).toBe(400)
    expect(await noId.json()).toEqual({ error: 'Missing id' })
    record('purge 401/400', '{"error":"Unauthorized"}', '{"error":"Missing id"}')
  })
})

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

describe('payload-icons wiring', () => {
  let payload: Payload
  let dbDir: string

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'icons-sandbox-'))
    process.env.DATABASE_URI = `file:${join(dbDir, 'test.db')}`
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    // The sqlite adapter binds DATABASE_URI at config import (before this hook), so clear the
    // seeded collections to keep the run idempotent. Also wipe the local-disk upload dir — the
    // icon collection's default static dir is `<cwd>/icon`; orphaned files there from a prior run
    // would make Payload dedupe filenames (`square` -> `square-2`) and break the name assertions.
    rmSync(join(process.cwd(), 'icon'), { recursive: true, force: true })
    const req = await createLocalReq({}, payload)
    await payload.db.deleteMany({ collection: 'icon', req, where: {} })
    await payload.db.deleteMany({ collection: 'pages', req, where: {} })
  })

  afterAll(async () => {
    await payload?.db?.destroy?.()
    if (dbDir) rmSync(dirname(join(dbDir, 'test.db')), { recursive: true, force: true })
  })

  it('registers the icon collection as an SVG upload with the expected fields', () => {
    const collection = payload.config.collections.find((c) => c.slug === 'icon')
    expect(collection).toBeDefined()
    expect(collection?.upload).toMatchObject({ mimeTypes: ['image/svg+xml'] })
    const fieldNames = (collection?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(fieldNames).toEqual(expect.arrayContaining(['optimized', 'svgString']))
  })

  it('registers the seed endpoint', () => {
    const paths = payload.config.endpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['POST /seed']))
  })

  it('exposes icon as a relationship target', () => {
    const pages = payload.config.collections.find((c) => c.slug === 'pages')
    const icon = (pages?.fields ?? []).find((f) => 'name' in f && f.name === 'icon')
    expect(icon).toMatchObject({ type: 'relationship', relationTo: 'icon' })
  })

  it('optimizes + sanitizes an uploaded SVG on create', async () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="#ff0000" onclick="alert(1)">
      <script>alert('xss')</script>
      <path d="M10 14 L30 14 L20 34 Z" fill="#ff0000"/>
    </svg>`
    const data = Buffer.from(dirty)

    const doc = (await payload.create({
      collection: 'icon',
      data: {},
      file: { name: 'triangle.svg', data, mimetype: 'image/svg+xml', size: data.byteLength },
      overrideAccess: true,
    })) as { id: string | number; svgString?: string; optimized?: string }

    expect(doc.svgString).toBeTruthy()
    expect(doc.svgString).toContain('currentColor')
    expect(doc.svgString).not.toContain('<script')
    expect(doc.svgString).not.toMatch(/onclick/i)
    expect(doc.svgString).not.toContain('#ff0000')
    expect(doc.optimized).toMatch(/SVG optimized/)
  })

  it('exposes the virtual name field on read', async () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>')
    const created = await payload.create({
      collection: 'icon',
      data: {},
      file: { name: 'square.svg', data, mimetype: 'image/svg+xml', size: data.byteLength },
      overrideAccess: true,
    })

    // Read back so the afterRead virtual computes.
    const doc = (await payload.findByID({ collection: 'icon', id: created.id, overrideAccess: true })) as { name?: string }
    expect(doc.name).toBe('square')
  })
})

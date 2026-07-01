import config from '@payload-config'
import { type ExportFontsResponse, fontAssetProvider } from '@pro-laico/payload-fonts'
import { seed } from '@pro-laico/payload-seed'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedDefinitions } from '@/plugins'

// Integration test: boots the real example config against a temp SQLite DB and drives the REAL
// seed engine via the Local API — the automated analog of the admin "Seed your database" flow.
// It exercises the whole fonts chain end to end: fontSource() tokens → font ingest hook uploads
// to fontOriginal → optimize hook subsets to fontOptimized → fontSet wired by ref() → the export
// endpoint hands back the served bytes.

let payload: Payload

const seedOptions = { definitions: seedDefinitions, assets: { dir: 'seed-assets' }, assetProviders: [fontAssetProvider()] }
const FAMILIES = ['sans', 'serif', 'mono', 'display'] as const

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await (payload as unknown as { destroy?: () => Promise<void> }).destroy?.()
})

/** Call the registered GET /fonts/export handler with a hand-built, authorized request. */
const callExport = async (secret = process.env.PAYLOAD_SECRET): Promise<Response> => {
  const endpoint = payload.config.endpoints.find((e) => e.method === 'get' && e.path === '/fonts/export')
  if (!endpoint) throw new Error('fonts export endpoint not registered')
  const req = { payload, headers: new Headers({ authorization: `Bearer ${secret}` }) }
  return endpoint.handler(req as never) as Promise<Response>
}

describe('payload-fonts seeding (integration)', () => {
  it('registers the font + hidden upload collections and the fontSet global', () => {
    expect(payload.collections.font).toBeDefined()
    expect(payload.collections.fontOriginal).toBeDefined()
    expect(payload.collections.fontOptimized).toBeDefined()
    expect(payload.config.globals.some((g) => g.slug === 'fontSet')).toBe(true)
  })

  it('seeds typefaces from local files: upload → subset → fontSet wiring', async () => {
    const result = await seed({ payload, options: seedOptions })

    // Four typefaces created in dependency order (they carry no inter-doc deps).
    expect(result.created.font).toBe(4)
    expect(result.order).toContain('font:inter')

    // Each typeface ingested its source into fontOriginal and produced a served fontOptimized.
    expect(await payload.find({ collection: 'font', limit: 0, depth: 0 }).then((r) => r.totalDocs)).toBe(4)
    expect(await payload.find({ collection: 'fontOriginal', limit: 0, depth: 0 }).then((r) => r.totalDocs)).toBe(4)
    const optimized = await payload.find({ collection: 'fontOptimized', limit: 0, depth: 0 })
    expect(optimized.totalDocs).toBe(4)

    // The ingest hook turned `source` into a real weights row pointing at an uploaded original.
    const inter = (await payload.find({ collection: 'font', where: { title: { equals: 'Inter' } }, depth: 0 })).docs[0] as {
      family?: string
      weights?: Array<{ file?: unknown; weight?: string }>
    }
    expect(inter.family).toBe('sans')
    expect(inter.weights?.[0]?.file).toBeTruthy()
    expect(inter.weights?.[0]?.weight).toBe('400')

    // The fontSet global was wired to the typefaces via ref() — sans → the Inter doc.
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1, overrideAccess: true })) as {
      sans?: { title?: string }
    }
    expect(fontSet.sans?.title).toBe('Inter')
  })

  it('serves the active fonts as base64 WOFF2 bytes per family from the export endpoint', async () => {
    const res = await callExport()
    expect(res.status).toBe(200)
    const json = (await res.json()) as ExportFontsResponse
    for (const family of FAMILIES) {
      const files = json.fonts[family]
      expect(files, `family ${family}`).toBeDefined()
      expect((files ?? []).length).toBeGreaterThan(0)
      expect(files?.[0]?.mimeType).toBe('font/woff2')
      expect(files?.[0]?.data.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('rejects an export request with a bad secret (401)', async () => {
    const res = await callExport('the-wrong-secret')
    expect(res.status).toBe(401)
  })

  it('is idempotent — re-seeding clears (cascading the hidden uploads) and recreates', async () => {
    await seed({ payload, options: seedOptions })
    expect(await payload.find({ collection: 'font', limit: 0 }).then((r) => r.totalDocs)).toBe(4)
    expect(await payload.find({ collection: 'fontOriginal', limit: 0 }).then((r) => r.totalDocs)).toBe(4)
    expect(await payload.find({ collection: 'fontOptimized', limit: 0 }).then((r) => r.totalDocs)).toBe(4)
  })
})

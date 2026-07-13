import config from '@payload-config'
import { type ExportFontsResponse, getActiveFontFaces } from '@pro-laico/payload-fonts'
import { seed } from '@pro-laico/payload-seed'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedDefinitions } from '@/plugins'

// Integration test: boots the real example config against a temp SQLite DB and drives the REAL
// seed engine via the Local API — the automated analog of the admin "Seed your database" flow.
// It exercises the whole fonts chain end to end: raw files seeded natively into fontOriginal →
// each typeface refs its original → the optimize hook subsets to fontOptimized → fontSet wired by
// ref() → the export endpoint hands back the served bytes.

let payload: Payload

const seedOptions = { definitions: seedDefinitions, assetsDir: 'seed-assets', assetSubDirs: { fontOriginal: 'font' } }
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

  it('seeds typefaces from local files: native original upload → ref → subset → fontSet wiring', async () => {
    const result = await seed({ payload, options: seedOptions })

    // Six originals uploaded, then five typefaces created after them (the ref() edges order the graph).
    expect(result.created.fontOriginal).toBe(6)
    expect(result.created.font).toBe(5)
    expect(result.order.indexOf('fontOriginal:inter-variable')).toBeLessThan(result.order.indexOf('font:inter'))

    // Each referenced original produced a served fontOptimized: Inter + Recursive variable → 1 each, Lora 400+700 → 2, mono + Abril → 1 each.
    expect(await payload.find({ collection: 'font', limit: 0, depth: 0 }).then((r) => r.totalDocs)).toBe(5)
    expect(await payload.find({ collection: 'fontOriginal', limit: 0, depth: 0 }).then((r) => r.totalDocs)).toBe(6)
    const optimized = await payload.find({ collection: 'fontOptimized', limit: 0, depth: 0 })
    expect(optimized.totalDocs).toBe(6)

    // The ref() wired the variable upright slot pointing at the uploaded original.
    const inter = (await payload.find({ collection: 'font', where: { title: { equals: 'Inter' } }, depth: 0 })).docs[0] as {
      family?: string
      variable?: { upright?: unknown }
    }
    expect(inter.family).toBe('sans')
    expect(inter.variable?.upright).toBeTruthy()

    // The fontSet global was wired to the typefaces via ref() — sans → the Inter doc.
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1 })) as {
      sans?: { title?: string }
    }
    expect(fontSet.sans?.title).toBe('Inter')
  })

  it('optimizes the seeded shapes: the variable font keeps its wght range, the multi-weight face gets a file per row', async () => {
    const fontId = async (title: string) =>
      (await payload.find({ collection: 'font', where: { title: { equals: title } }, depth: 0 })).docs[0].id
    const optimizedFor = async (title: string) =>
      (await payload.find({ collection: 'fontOptimized', where: { font: { equals: await fontId(title) } }, depth: 0 })).docs as Array<{
        weight?: string
        isVariable?: boolean
      }>

    // Inter variable: one optimized file carrying the full axis range, flagged variable.
    const inter = await optimizedFor('Inter')
    expect(inter).toHaveLength(1)
    expect(inter[0].isVariable).toBe(true)
    expect(inter[0].weight).toBe('100 900')

    // Lora 400 + 700: one static optimized file per weight row.
    const lora = await optimizedFor('Lora')
    expect(lora.map((d) => d.weight).sort()).toEqual(['400', '700'])
    expect(lora.every((d) => d.isVariable === false)).toBe(true)
  })

  it('flags the ital-capable variable file and serves an upright + italic face pair from it', async () => {
    // Recursive's ONE upright file carries a slnt 0…-15 axis: the optimize hook detects it and
    // flags the served doc, keeping the full wght range and recording the CSS oblique angle.
    const recursiveId = (await payload.find({ collection: 'font', where: { title: { equals: 'Recursive' } }, depth: 0 })).docs[0].id
    const optimized = (await payload.find({ collection: 'fontOptimized', where: { font: { equals: recursiveId } }, depth: 0 })).docs as Array<{
      weight?: string
      style?: string
      isVariable?: boolean
      italCapable?: boolean
      obliqueAngle?: number
    }>
    expect(optimized).toHaveLength(1)
    expect(optimized[0].isVariable).toBe(true)
    expect(optimized[0].weight).toBe('300 1000')
    expect(optimized[0].style).toBe('normal')
    expect(optimized[0].italCapable).toBe(true)
    expect(optimized[0].obliqueAngle).toBe(15)

    // getActiveFontFaces expands that single file into TWO served faces for the display family:
    // the upright, plus a synthesized italic (oblique 15deg) over the SAME filename.
    const active = await getActiveFontFaces(payload)
    const display = active.find((a) => a.family === 'display')
    expect(display).toBeDefined()
    expect(display?.id).toBe(recursiveId)
    expect(display?.faces).toHaveLength(2)
    const normal = display?.faces.find((f) => f.style === 'normal')
    const italic = display?.faces.find((f) => f.style === 'italic')
    expect(normal).toBeDefined()
    expect(italic).toBeDefined()
    expect(normal?.filename).toBe(italic?.filename)
    expect(normal?.obliqueAngle).toBeUndefined()
    expect(italic?.obliqueAngle).toBe(15)
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
    expect(await payload.find({ collection: 'font', limit: 0 }).then((r) => r.totalDocs)).toBe(5)
    expect(await payload.find({ collection: 'fontOriginal', limit: 0 }).then((r) => r.totalDocs)).toBe(6)
    expect(await payload.find({ collection: 'fontOptimized', limit: 0 }).then((r) => r.totalDocs)).toBe(6)
  })
})

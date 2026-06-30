import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getActiveFontFaces, ingestFont } from '@pro-laico/payload-fonts'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootFonts } from './helpers'

// Direct coverage of the `font` collection hooks against a real (in-memory) Payload: the
// subset/optimize reconcile, variable detection, update reconcile, asset cleanup on delete, the
// validation guards, and the server-side `source` ingest seam. No app config / shared DB.

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/inter.woff2', import.meta.url)))
const variableFixture = readFileSync(fileURLToPath(new URL('./fixtures/inter-variable.woff2', import.meta.url)))
const variablePath = fileURLToPath(new URL('./fixtures/inter-variable.woff2', import.meta.url))
const staticPath = fileURLToPath(new URL('./fixtures/inter.woff2', import.meta.url))

type Doc = Record<string, unknown>
type Id = string | number

let payload: Payload
let cleanup: () => Promise<void>

beforeAll(async () => {
  ;({ payload, cleanup } = await bootFonts())
})
afterAll(async () => {
  await cleanup?.()
})

/** Upload a raw font into `fontOriginal`, returning its id. */
const upOriginal = async (data: Buffer, name: string): Promise<Id> => {
  const doc = (await payload.create({
    collection: 'fontOriginal',
    overrideAccess: true,
    data: {},
    file: { data, name, mimetype: 'font/woff2', size: data.byteLength },
  } as Parameters<typeof payload.create>[0])) as unknown as Doc
  return doc.id as Id
}
const optimizedFor = async (fontId: Id): Promise<Doc[]> => {
  const res = await payload.find({
    collection: 'fontOptimized' as never,
    where: { font: { equals: fontId } },
    overrideAccess: true,
    limit: 100,
  })
  return res.docs as Doc[]
}
const originalExists = async (id: Id): Promise<boolean> => {
  try {
    await payload.findByID({ collection: 'fontOriginal' as never, id, overrideAccess: true })
    return true
  } catch {
    return false
  }
}
const createFont = (data: Record<string, unknown>) =>
  payload.create({ collection: 'font', overrideAccess: true, data } as Parameters<typeof payload.create>[0]) as unknown as Promise<Doc>

describe('font collection hooks (integration)', () => {
  it('builds an optimized WOFF2 per weight row on save (weight/style from the row)', async () => {
    const a = await upOriginal(fixture, 'Inter-Regular.woff2')
    const b = await upOriginal(fixture, 'Inter-Bold.woff2')
    const font = await createFont({
      title: 'Inter',
      family: 'sans',
      weights: [
        { weight: '400', style: 'normal', file: a },
        { weight: '700', style: 'normal', file: b },
      ],
    })

    const opt = await optimizedFor(font.id as Id)
    expect(opt).toHaveLength(2)
    for (const d of opt) expect(d.mimeType).toBe('font/woff2')
    expect(opt.map((d) => d.weight).sort()).toEqual(['400', '700'])
    expect(opt.every((d) => d.isVariable === false)).toBe(true)
  })

  it('detects a variable upright + italic into ranged optimized files', async () => {
    const up = await upOriginal(variableFixture, 'Inter-Variable.woff2')
    const it = await upOriginal(variableFixture, 'Inter-Variable-Italic.woff2')
    const font = await createFont({ title: 'Inter Variable', family: 'display', variable: { upright: up, italic: it } })

    const opt = await optimizedFor(font.id as Id)
    expect(opt).toHaveLength(2)
    for (const d of opt) {
      expect(d.weight).toBe('100 900')
      expect(d.isVariable).toBe(true)
    }
    expect(opt.map((d) => d.style).sort()).toEqual(['italic', 'normal'])
  })

  it('reconciles on update: a removed weight drops its optimized file', async () => {
    const a = await upOriginal(fixture, 'Recon-Regular.woff2')
    const b = await upOriginal(fixture, 'Recon-Bold.woff2')
    const font = await createFont({
      title: 'Recon',
      family: 'serif',
      weights: [
        { weight: '400', style: 'normal', file: a },
        { weight: '700', style: 'normal', file: b },
      ],
    })
    expect(await optimizedFor(font.id as Id)).toHaveLength(2)

    await payload.update({
      collection: 'font',
      id: font.id as Id,
      overrideAccess: true,
      data: { weights: [{ weight: '400', style: 'normal', file: a }] },
    } as Parameters<typeof payload.update>[0])

    const opt = await optimizedFor(font.id as Id)
    expect(opt).toHaveLength(1)
    expect(opt[0].weight).toBe('400')
  })

  it('deletes the orphaned original when a slot file is swapped (and not shared)', async () => {
    const a = await upOriginal(fixture, 'Swap-A.woff2')
    const b = await upOriginal(fixture, 'Swap-B.woff2')
    const font = await createFont({ title: 'Swap', family: 'sans', weights: [{ weight: '400', style: 'normal', file: a }] })
    expect(await originalExists(a)).toBe(true)

    await payload.update({
      collection: 'font',
      id: font.id as Id,
      overrideAccess: true,
      data: { weights: [{ weight: '400', style: 'normal', file: b }] },
    } as Parameters<typeof payload.update>[0])

    expect(await originalExists(a)).toBe(false)
    expect(await originalExists(b)).toBe(true)
    expect(await optimizedFor(font.id as Id)).toHaveLength(1)
  })

  it('cascades delete to optimized + original files (beforeDelete, relationship still intact)', async () => {
    const a = await upOriginal(fixture, 'Doomed-Regular.woff2')
    const font = await createFont({ title: 'Doomed', family: 'mono', weights: [{ weight: '400', style: 'normal', file: a }] })
    expect(await optimizedFor(font.id as Id)).toHaveLength(1)

    await payload.delete({ collection: 'font', id: font.id as Id, overrideAccess: true } as unknown as Parameters<typeof payload.delete>[0])

    expect(await optimizedFor(font.id as Id)).toHaveLength(0)
    expect(await originalExists(a)).toBe(false)
  })

  it('rejects a typeface with no files', async () => {
    await expect(createFont({ title: 'Empty', family: 'sans' })).rejects.toThrow(/at least one/i)
  })

  it('rejects mixing a variable font with specific weights', async () => {
    const v = await upOriginal(variableFixture, 'Mix-Variable.woff2')
    const w = await upOriginal(fixture, 'Mix-Regular.woff2')
    await expect(
      createFont({ title: 'Mixed', family: 'sans', variable: { upright: v }, weights: [{ weight: '400', style: 'normal', file: w }] }),
    ).rejects.toThrow(/either a variable font or specific/i)
  })

  it('rejects two weight rows at the same weight + style', async () => {
    const a = await upOriginal(fixture, 'Dup-A.woff2')
    const b = await upOriginal(fixture, 'Dup-B.woff2')
    await expect(
      createFont({
        title: 'Dupe',
        family: 'sans',
        weights: [
          { weight: '400', style: 'normal', file: a },
          { weight: '400', style: 'normal', file: b },
        ],
      }),
    ).rejects.toThrow(/weight/i)
  })

  it('rejects an original already used by another typeface, but lets a typeface re-save its own', async () => {
    const shared = await upOriginal(variableFixture, 'Guard-Shared.woff2')
    const owner = await createFont({ title: 'Owner', family: 'sans', variable: { upright: shared } })
    await expect(createFont({ title: 'Thief', family: 'serif', variable: { upright: shared } })).rejects.toThrow(/already used by/i)

    // Re-submitting the same slot value on the owner must NOT trip the uniqueness guard.
    await expect(
      payload.update({
        collection: 'font',
        id: owner.id as Id,
        overrideAccess: true,
        data: { title: 'Owner renamed', variable: { upright: shared } },
      } as Parameters<typeof payload.update>[0]),
    ).resolves.toBeTruthy()
  })

  it('ingestFont creates a typeface from a file path (server-side `source` seam)', async () => {
    const doc = await ingestFont(payload, { source: staticPath, title: 'Ingested', family: 'sans', weight: '500' })
    const font = (await payload.findByID({ collection: 'font', id: doc.id, overrideAccess: true })) as unknown as Doc & {
      source?: unknown
      weights?: Array<{ weight?: string; file?: unknown }>
    }
    // `source` is consumed + stripped; a weights row points at the uploaded original.
    expect(font.source).toBeFalsy()
    expect(font.weights?.[0]?.weight).toBe('500')
    expect(font.weights?.[0]?.file).toBeTruthy()
    expect(await optimizedFor(font.id as Id)).toHaveLength(1)
  })

  it('ingestFont handles a variable font (fills the variable group)', async () => {
    const doc = await ingestFont(payload, { source: variablePath, title: 'Ingested Variable', family: 'display', variable: true })
    const font = (await payload.findByID({ collection: 'font', id: doc.id, overrideAccess: true })) as unknown as Doc & {
      variable?: { upright?: unknown }
    }
    expect(font.variable?.upright).toBeTruthy()
    const opt = await optimizedFor(font.id as Id)
    expect(opt).toHaveLength(1)
    expect(opt[0].isVariable).toBe(true)
  })

  it('getActiveFontFaces resolves the fontSet selection to served faces', async () => {
    const id = await upOriginal(fixture, 'Active-Regular.woff2')
    const font = await createFont({ title: 'Active Sans', family: 'sans', weights: [{ weight: '400', style: 'normal', file: id }] })
    await payload.updateGlobal({ slug: 'fontSet', overrideAccess: true, data: { sans: font.id } } as Parameters<typeof payload.updateGlobal>[0])

    const active = await getActiveFontFaces(payload)
    const sans = active.find((a) => a.role === 'sans')
    expect(sans).toBeDefined()
    expect(sans?.id).toBe(font.id)
    expect(sans?.faces[0]?.filename).toMatch(/\.woff2$/)
    expect(sans?.faces[0]?.weight).toBe('400')
  })

  it('populates a font relationship leanly — defaultPopulate omits the private upload slots', async () => {
    const id = await upOriginal(fixture, 'Pop-Regular.woff2')
    const font = await createFont({ title: 'Populated', family: 'display', weights: [{ weight: '400', style: 'normal', file: id }] })
    await payload.updateGlobal({ slug: 'fontSet', overrideAccess: true, data: { display: font.id } } as Parameters<
      typeof payload.updateGlobal
    >[0])

    // Traverse fontSet → font; `defaultPopulate` returns identifying metadata only.
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1, overrideAccess: true })) as { display?: Record<string, unknown> }
    const f = fontSet.display as { title?: string; family?: string; weights?: unknown; variable?: unknown }

    expect(f.title).toBe('Populated')
    expect(f.family).toBe('display')
    // The private upload slots are omitted — no fontOriginal blobs dragged through population.
    expect(f.weights).toBeUndefined()
    expect(f.variable).toBeUndefined()
  })
})

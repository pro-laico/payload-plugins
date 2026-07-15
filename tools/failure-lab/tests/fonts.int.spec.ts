import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fontsPlugin } from '@pro-laico/payload-fonts'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootLab, type LabBoot } from '@/boot'
import { clearLogs, warnMessages } from '@/logCapture'
import { createReport } from './report'

// payload-fonts failure paths: the typeface validation APIErrors (legible, thrown) and the
// optimize-hook warn paths (corrupt bytes / missing file) — where the SAVE SUCCEEDS and the only
// signal is a logger.warn naming the typeface + original filename.
//
// Uploads need REAL font bytes: Payload sniffs the buffer's actual type against the MIME
// allowlist, so garbage never gets past create. Corruption is simulated by overwriting the stored
// file on disk AFTER upload — the optimize hook reads bytes from the staticDir.

const record = createReport('payload-fonts')

let lab: LabBoot
let payload: Payload
let dir: string
let fixture: Buffer // real WOFF2 (Inter subset)

const createOriginal = async (name: string) =>
  (await payload.create({
    collection: 'fontOriginal' as never,
    data: {} as never,
    file: { name, data: fixture, mimetype: 'font/woff2', size: fixture.byteLength },
  })) as unknown as { id: string | number; filename: string }

beforeAll(async () => {
  fixture = await readFile(join('assets', 'font', 'inter.woff2'))
  dir = mkdtempSync(join(tmpdir(), 'failure-lab-fonts-'))
  lab = await bootLab({
    plugins: [
      fontsPlugin({
        fontOriginalOverrides: { upload: { staticDir: join(dir, 'original') } },
        fontOptimizedOverrides: { upload: { staticDir: join(dir, 'optimized') } },
      }),
    ],
  })
  payload = lab.payload
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
  rmSync(dir, { recursive: true, force: true })
})

describe('typeface validation (thrown APIErrors — the save is rejected)', () => {
  it('a typeface with no files at all is rejected with a plain instruction', async () => {
    const err = await payload.create({ collection: 'font' as never, data: { title: 'Empty Face', family: 'sans' } as never }).then(
      () => undefined,
      (e: Error) => e,
    )
    expect(err?.message).toContain('Add at least one font file before saving.')
    record('typeface with no files', err?.message)
  })

  it('an original already used by another typeface is rejected NAMING the owning typeface', async () => {
    const orig = await createOriginal('shared.woff2')
    await payload.create({
      collection: 'font' as never,
      data: { title: 'First Face', family: 'sans', weights: [{ weight: '400', style: 'normal', file: orig.id }] } as never,
    })
    const err = await payload
      .create({
        collection: 'font' as never,
        data: { title: 'Second Face', family: 'sans', weights: [{ weight: '400', style: 'normal', file: orig.id }] } as never,
      })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(err?.message).toContain('already used by First Face') // names the OWNER, not an id
    record('original shared across typefaces', err?.message)
  })

  it('two weight rows at the same weight+style are rejected naming the collision', async () => {
    const a = await createOriginal('dup-a.woff2')
    const b = await createOriginal('dup-b.woff2')
    const err = await payload
      .create({
        collection: 'font' as never,
        data: {
          title: 'Duplicate Weights',
          family: 'sans',
          weights: [
            { weight: '400', style: 'normal', file: a.id },
            { weight: '400', style: 'normal', file: b.id },
          ],
        } as never,
      })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    // Payload's top-level ValidationError message only lists FIELD LABELS ("The following fields
    // are invalid: Preferred Family, Weights") — the validate()'s own words live in data.errors.
    const fieldErrors = ((err as { data?: { errors?: Array<{ message?: string }> } })?.data?.errors ?? []).map((e) => e.message).join('; ')
    expect(fieldErrors).toContain('Two files share weight 400 normal')
    record('duplicate weight+style rows', `top-level: ${err?.message}`, `data.errors: ${fieldErrors}`)
  })

  it('non-font BYTES are rejected up front — Payload sniffs the buffer against the MIME allowlist', async () => {
    const garbage = Buffer.from('definitely not a font, just some bytes pretending')
    const err = await payload
      .create({
        collection: 'fontOriginal' as never,
        data: {} as never,
        file: { name: 'fake.woff2', data: garbage, mimetype: 'font/woff2', size: garbage.byteLength }, // lies about its type
      })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(err).toBeTruthy() // message text is Payload core's — assert the rejection, record the text
    record('garbage bytes claiming font/woff2 (sniffed + rejected by Payload core)', err?.message)
  })
})

describe('optimize-hook failures (the save SUCCEEDS — a logger.warn is the only signal)', () => {
  it('corrupt font bytes: the typeface saves, zero optimized files, one warn naming the original', async () => {
    clearLogs()
    const orig = await createOriginal('corrupt.woff2')
    // Corrupt the stored bytes AFTER upload — the optimize hook reads them back from the staticDir.
    await writeFile(join(dir, 'original', orig.filename), 'no longer a font')
    const doc = (await payload.create({
      collection: 'font' as never,
      data: { title: 'Corrupt Face', family: 'serif', weights: [{ weight: '700', style: 'normal', file: orig.id }] } as never,
    })) as unknown as { id: string | number }
    expect(doc.id).toBeTruthy() // silent-ish success…

    const optimized = await payload.find({
      collection: 'fontOptimized' as never,
      where: { font: { equals: doc.id } } as never,
    })
    expect(optimized.totalDocs).toBe(0) // …with broken output

    const warn = warnMessages().find((w) => w.includes('optimization failed'))
    expect(warn).toContain("typeface 'Corrupt Face'") // names the typeface…
    expect(warn).toContain("'corrupt.woff2'") // …and the file, not just an id
    expect(warn).toContain('will NOT be served') // …and the consequence
    record('corrupt font bytes (save succeeds!)', warn)
  })

  it("missing original file: the typeface saves, a warn says it couldn't read the original", async () => {
    const orig = await createOriginal('vanishing.woff2')
    await rm(join(dir, 'original', orig.filename), { force: true }) // bytes vanish; doc remains
    clearLogs()
    const doc = (await payload.create({
      collection: 'font' as never,
      data: { title: 'Vanishing Face', family: 'mono', weights: [{ weight: '400', style: 'italic', file: orig.id }] } as never,
    })) as unknown as { id: string | number }
    expect(doc.id).toBeTruthy()

    const warn = warnMessages().find((w) => w.includes('could not read'))
    expect(warn).toContain("typeface 'Vanishing Face'")
    expect(warn).toContain("'vanishing.woff2'")
    record('original file missing from disk (save succeeds!)', warn)
  })
})

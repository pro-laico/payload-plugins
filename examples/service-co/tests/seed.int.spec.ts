import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { seed } from '@pro-laico/payload-seed'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'
import { seedOptions } from '../src/plugins'

// One end-to-end pass: run the same offline seed the admin button / POST /api/seed does, then assert
// every plugin ended up wired. There are no MUX_* creds here, so the run also exercises the
// seed-disabled path: the plugin marks `mux-video`, the engine skips the videos definition, and the
// site-settings showreel ref is dropped — everything else must still resolve.
describe('service-co — all plugins seed together', () => {
  let payload: Payload
  let dbDir: string
  let result: Awaited<ReturnType<typeof seed>>

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'service-co-'))
    process.env.DATABASE_URI = `file:${join(dbDir, 'test.db')}`
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })

    // The sqlite adapter binds DATABASE_URI at config import, so wipe the plugin + content
    // collections to keep the run idempotent. Also clear the local-disk upload dirs so re-runs
    // don't dedupe filenames.
    for (const dir of ['images', 'generated-images', 'icon', 'fontOriginal', 'fontOptimized']) {
      rmSync(join(process.cwd(), dir), { recursive: true, force: true })
    }
    const req = await createLocalReq({}, payload)
    const wipe = ['services', 'projects', 'team', 'testimonials', 'images', 'icon', 'iconSet', 'font', 'fontOriginal', 'fontOptimized'] as const
    for (const slug of wipe) {
      await payload.db.deleteMany({ collection: slug, req, where: {} })
    }

    result = await seed({ payload, options: seedOptions })
  })

  afterAll(async () => {
    await payload?.db?.destroy?.()
    if (dbDir) rmSync(dirname(join(dbDir, 'test.db')), { recursive: true, force: true })
  })

  it('registers every plugin collection + global', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    expect(slugs).toEqual(
      expect.arrayContaining(['services', 'projects', 'team', 'testimonials', 'images', 'icon', 'iconSet', 'mux-video', 'font']),
    )
    const globals = payload.config.globals.map((g) => g.slug)
    expect(globals).toEqual(expect.arrayContaining(['site-settings', 'fontSet']))
  })

  it('seeds the content collections', async () => {
    for (const [slug, count] of [
      ['services', 4],
      ['projects', 3],
      ['team', 3],
      ['testimonials', 3],
      ['images', 14],
      // 10 names × 2 glyph families (Default + Alternate sets)
      ['icon', 20],
      ['iconSet', 2],
      ['payload-folders', 4],
    ] as const) {
      const { totalDocs } = await payload.find({ collection: slug, limit: 0, overrideAccess: true })
      expect(totalDocs, slug).toBe(count)
    }
  })

  it('payload folders: every image files into a seeded folder', async () => {
    const { docs } = await payload.find({ collection: 'payload-folders', depth: 0, overrideAccess: true })
    expect(docs.map((f) => (f as { name?: string }).name).sort()).toEqual(['Projects', 'Services', 'Site', 'Team'])
    const projects = docs.find((f) => (f as { name?: string }).name === 'Projects') as { id: string | number }
    const { totalDocs } = await payload.find({
      collection: 'images',
      where: { folder: { equals: projects.id } },
      limit: 0,
      overrideAccess: true,
    })
    expect(totalDocs).toBe(6)
    const unfiled = await payload.find({
      collection: 'images',
      where: { or: [{ folder: { exists: false } }, { folder: { equals: null } }] },
      limit: 0,
      overrideAccess: true,
    })
    expect(unfiled.totalDocs).toBe(0)
  })

  it('payload-images: stores dimensions on upload (originals ready to transform on demand)', async () => {
    const { docs } = await payload.find({ collection: 'images', where: { filename: { contains: 'hero' } }, limit: 1, overrideAccess: true })
    const hero = docs[0] as { width?: number; height?: number }
    expect(hero?.width).toBeGreaterThan(0)
    expect(hero?.height).toBeGreaterThan(0)
  })

  it('payload-icons: optimizes SVGs to currentColor and an active set maps them', async () => {
    const { docs } = await payload.find({
      collection: 'icon',
      where: { filename: { equals: 'architecture.svg' } },
      limit: 1,
      overrideAccess: true,
    })
    const architecture = docs[0] as { svgString?: string }
    expect(architecture?.svgString).toContain('currentColor')

    const { docs: sets } = await payload.find({
      collection: 'iconSet',
      where: { active: { equals: true } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(sets).toHaveLength(1)
  })

  it('payload-seed: resolves cross-collection refs (project → cover image + services)', async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: 'cedar-hill-residence' } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })
    const project = docs[0] as { coverImage?: { id?: unknown }; services?: unknown[]; featured?: boolean }
    expect(project?.featured).toBe(true)
    expect(project?.coverImage).toBeTypeOf('object')
    expect((project?.services ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('payload-fonts: an active fontSet points at seeded typefaces', async () => {
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
    // Each family slot holds a `font` id once the selection is wired.
    expect(fontSet.sans ?? fontSet.serif ?? fontSet.display).toBeTruthy()
  })

  it('payload-fonts: a single variable file carrying both styles is flagged ital-capable', async () => {
    // Recursive's one upload has wght 300–1000 AND slnt 0…-15 — the optimize hook detects the
    // slant range and marks the served file so an italic face is emitted from the same WOFF2.
    const { docs } = await payload.find({ collection: 'font', where: { title: { equals: 'Recursive' } }, depth: 0, overrideAccess: true })
    const recursive = docs[0] as { id: string | number }
    const optimized = await payload.find({
      collection: 'fontOptimized',
      where: { font: { equals: recursive.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(optimized.docs).toHaveLength(1)
    const face = optimized.docs[0] as { weight?: string; style?: string; isVariable?: boolean; italCapable?: boolean; obliqueAngle?: number }
    expect(face.isVariable).toBe(true)
    expect(face.weight).toBe('300 1000')
    expect(face.style).toBe('normal')
    expect(face.italCapable).toBe(true)
    expect(face.obliqueAngle).toBe(15)
  })

  it('payload-fonts: explicit italics upload alongside their uprights (Inter variable, Lora/JBM statics)', async () => {
    const { docs } = await payload.find({ collection: 'font', where: { title: { equals: 'Inter' } }, depth: 0, overrideAccess: true })
    const inter = docs[0] as { id: string | number }
    const optimized = await payload.find({ collection: 'fontOptimized', where: { font: { equals: inter.id } }, depth: 0, overrideAccess: true })
    const styles = (optimized.docs as { style?: string; weight?: string }[]).map((d) => `${d.weight}/${d.style}`).sort()
    expect(styles).toEqual(['100 900/italic', '100 900/normal'])

    const { totalDocs: optimizedTotal } = await payload.find({ collection: 'fontOptimized', limit: 0, overrideAccess: true })
    // Inter 2 (variable pair) + Lora 4 + JetBrains Mono 4 (400/700 × normal/italic) + Recursive 1
    expect(optimizedTotal).toBe(11)
  })

  it('SiteSettings global resolves its refs (hero image + featured project)', async () => {
    const settings = (await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true })) as {
      companyName?: string
      heroImage?: { id?: unknown }
      featuredProject?: { id?: unknown }
    }
    expect(settings.companyName).toBe('Meridian')
    expect(settings.heroImage).toBeTypeOf('object')
    expect(settings.featuredProject).toBeTypeOf('object')
  })

  it('payload-seed: skips the credential-gated mux-video definition and drops the showreel ref', async () => {
    // No MUX_* creds in the test env → the plugin marks the collection seed-disabled, the engine
    // skips the videos definition (reporting why), and the optional showreel ref is dropped rather
    // than failing the run. With creds, the same seed ingests the clip and wires the ref.
    expect(result.skipped).toEqual([{ slug: 'mux-video', reason: expect.stringContaining('MUX_TOKEN_ID') }])
    const { totalDocs } = await payload.find({ collection: 'mux-video', limit: 0, overrideAccess: true })
    expect(totalDocs).toBe(0)
    const settings = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { showreel?: unknown }
    expect(settings.showreel ?? null).toBeNull()
  })

  // Keep this LAST — it reruns the whole seed, so every doc id above changes.
  it('reseeds cleanly over a populated database (dependents cleared before their dependencies)', async () => {
    // The case a fresh-DB run can't catch: the previous run's projects still reference images
    // (a required in-array upload is NOT NULL with an ON DELETE SET NULL FK on sqlite), so
    // clearing images FIRST used to fail those deletes and strand stale docs. The engine now
    // clears in reverse creation order — dependents go first.
    const second = await seed({ payload, options: seedOptions })
    expect(Object.keys(second.created).length).toBeGreaterThan(0)

    for (const [slug, count] of [
      ['images', 14],
      ['icon', 20],
      ['iconSet', 2],
      ['payload-folders', 4],
      ['projects', 3],
      ['services', 4],
    ] as const) {
      const { totalDocs } = await payload.find({ collection: slug, limit: 0, overrideAccess: true })
      expect(totalDocs, `${slug} after reseed`).toBe(count)
    }
    // No strays: every image belongs to a folder, exactly as a single seed produces.
    const unfiled = await payload.find({
      collection: 'images',
      where: { or: [{ folder: { exists: false } }, { folder: { equals: null } }] },
      limit: 0,
      overrideAccess: true,
    })
    expect(unfiled.totalDocs).toBe(0)
  })
})

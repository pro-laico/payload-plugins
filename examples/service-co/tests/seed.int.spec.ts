import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { seed } from '@pro-laico/payload-seed'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'
import { seedOptions } from '../src/plugins'

// One end-to-end pass: run the same offline seed the admin button / POST /api/seed does, then assert
// every plugin ended up wired. Mux is credential-gated, so it's excluded here (no MUX_TOKEN_ID) and
// the site's mux-video refs simply don't seed — everything else must still resolve.
describe('service-co — all plugins seed together', () => {
  let payload: Payload
  let dbDir: string

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

    await seed({ payload, options: seedOptions })
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
      ['icon', 10],
    ] as const) {
      const { totalDocs } = await payload.find({ collection: slug, limit: 0, overrideAccess: true })
      expect(totalDocs, slug).toBe(count)
    }
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
})

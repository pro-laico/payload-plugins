import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createLocalReq, getPayload, type Payload, type Where } from 'payload'
// recordMiss is the no-`server-only` seam (by design) for the runtime tracker; imported from source
// since it isn't a public subpath export.
import { recordIconMiss } from '../../../packages/payload-icons/src/usage/recordMiss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'

/** Upload an SVG to the icon collection (runs formatSVGHook) and return the doc. `id` is typed
 *  `number` to match this sandbox's sqlite-generated relationship types. */
const uploadIcon = async (payload: Payload, name: string, pathD: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#123456"><path d="${pathD}"/></svg>`
  const data = Buffer.from(svg)
  return (await payload.create({
    collection: 'icon',
    data: {},
    file: { name: `${name}.svg`, data, mimetype: 'image/svg+xml', size: data.byteLength },
  })) as { id: number; svgString?: string }
}

const svgOf = async (payload: Payload, id: number) => ((await payload.findByID({ collection: 'icon', id })) as { svgString?: string }).svgString

/** Replicates `getActiveIconSet`: the active set's name→svg map in one populated query, with the
 *  `_status: published` guard on the published path (so a draft-lane-active set can't leak). */
const activeMap = async (payload: Payload, draft = false): Promise<Record<string, string>> => {
  const where: Where = draft ? { active: { equals: true } } : { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] }
  const set = (await payload
    .find({
      collection: 'iconSet',
      where,
      limit: 1,
      depth: 1,
      draft,
      pagination: false,
      select: { iconsArray: true },
      populate: { icon: { svgString: true } },
    })
    .then((r) => r.docs[0] || null)) as {
    iconsArray?: { name?: string | null; icon?: { svgString?: string | null } | string | number | null }[]
  } | null
  if (!set) return {}
  const map: Record<string, string> = {}
  for (const row of set.iconsArray ?? []) {
    const svg = row?.icon && typeof row.icon === 'object' ? row.icon.svgString : undefined
    if (row?.name && svg) map[row.name] = svg
  }
  return map
}

const resolveName = async (payload: Payload, name: string, draft = false): Promise<string | undefined> =>
  (await activeMap(payload, draft))[name]

describe('payload-icons — iconSet active toggle + resolution', () => {
  let payload: Payload
  let dbDir: string

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'iconsets-sandbox-'))
    process.env.DATABASE_URI = `file:${join(dbDir, 'test.db')}`
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    rmSync(join(process.cwd(), 'icon'), { recursive: true, force: true })
    const req = await createLocalReq({}, payload)
    for (const collection of ['icon', 'iconSet', 'iconRequest'] as const) {
      await payload.db.deleteMany({ collection, req, where: {} })
    }
  })

  afterAll(async () => {
    await payload?.db?.destroy?.()
    if (dbDir) rmSync(dirname(join(dbDir, 'test.db')), { recursive: true, force: true })
  })

  const clearSets = () => payload.delete({ collection: 'iconSet', where: { id: { exists: true } } })

  it('registers iconSet with an active flag + iconsArray + drafts, and iconRequest — and no global', () => {
    const set = payload.config.collections.find((c) => c.slug === 'iconSet')
    expect(set).toBeDefined()
    expect(set?.versions).toMatchObject({ drafts: expect.anything() })
    const flat = set?.flattenedFields?.map((f) => f.name) ?? []
    expect(flat).toEqual(expect.arrayContaining(['active', 'iconsArray']))
    expect(payload.config.collections.find((c) => c.slug === 'iconRequest')).toBeDefined()
    expect(payload.config.globals.find((g) => g.slug === 'iconSettings')).toBeUndefined()
  })

  it('kebab-cases an iconsArray name on save', async () => {
    const glyph = await uploadIcon(payload, 'kebab-src', 'M4 12h16')
    const created = (await payload.create({
      collection: 'iconSet',
      data: { title: 'Kebab', _status: 'published', iconsArray: [{ name: 'Arrow Right', icon: glyph.id }] },
    })) as { iconsArray?: { name?: string }[] }
    expect(created.iconsArray?.[0]?.name).toBe('arrow-right')
    await clearSets()
  })

  it('enforces the single-active invariant in the published lane', async () => {
    const a = await payload.create({ collection: 'iconSet', data: { title: 'A', active: true, _status: 'published' } })
    const b = await payload.create({ collection: 'iconSet', data: { title: 'B', active: true, _status: 'published' } })

    let aDoc = (await payload.findByID({ collection: 'iconSet', id: a.id })) as { active?: boolean }
    expect(aDoc.active).toBe(false) // activating B deactivated A
    let bDoc = (await payload.findByID({ collection: 'iconSet', id: b.id })) as { active?: boolean }
    expect(bDoc.active).toBe(true)

    await payload.update({ collection: 'iconSet', id: a.id, data: { active: true, _status: 'published' } })
    aDoc = (await payload.findByID({ collection: 'iconSet', id: a.id })) as { active?: boolean }
    bDoc = (await payload.findByID({ collection: 'iconSet', id: b.id })) as { active?: boolean }
    expect(aDoc.active).toBe(true)
    expect(bDoc.active).toBe(false)

    const count = await payload.count({ collection: 'iconSet', where: { active: { equals: true } } })
    expect(count.totalDocs).toBe(1)
    await clearSets()
  })

  it('resolves a name through the active set to its icon svgString (one populated query)', async () => {
    const arrow = await uploadIcon(payload, 'arrow-right', 'M4 12h16')
    const check = await uploadIcon(payload, 'check', 'M5 13l4 4L19 7')
    await payload.create({
      collection: 'iconSet',
      data: {
        title: 'Default',
        active: true,
        _status: 'published',
        iconsArray: [
          { name: 'arrow-right', icon: arrow.id },
          { name: 'check', icon: check.id },
        ],
      },
    })

    const map = await activeMap(payload)
    expect(Object.keys(map).sort()).toEqual(['arrow-right', 'check'])
    const svg = await resolveName(payload, 'arrow-right')
    expect(svg).toBeTruthy()
    expect(svg).toContain('currentColor') // themed on upload
    expect(await resolveName(payload, 'nope')).toBeUndefined() // miss → undefined (component falls back)
    await clearSets()
  })

  it('re-skins every icon when a different set is activated', async () => {
    const lineStar = await uploadIcon(payload, 'star-line', 'M12 2l3 7h7l-5 5')
    const solidStar = await uploadIcon(payload, 'star-solid', 'M12 17l-6 4 2-7-5-4h7z')
    const lineSvg = await svgOf(payload, lineStar.id)
    const solidSvg = await svgOf(payload, solidStar.id)
    expect(lineSvg).not.toBe(solidSvg)

    const line = await payload.create({
      collection: 'iconSet',
      data: { title: 'Line', active: true, _status: 'published', iconsArray: [{ name: 'star', icon: lineStar.id }] },
    })
    const solid = await payload.create({
      collection: 'iconSet',
      data: { title: 'Solid', active: false, _status: 'published', iconsArray: [{ name: 'star', icon: solidStar.id }] },
    })
    expect(await resolveName(payload, 'star')).toBe(lineSvg)

    // Activate the other set — the same name now resolves to a different glyph site-wide.
    await payload.update({ collection: 'iconSet', id: solid.id, data: { active: true, _status: 'published' } })
    expect(await resolveName(payload, 'star')).toBe(solidSvg)
    // line was deactivated by the single-active invariant
    const lineDoc = (await payload.findByID({ collection: 'iconSet', id: line.id })) as { active?: boolean }
    expect(lineDoc.active).toBe(false)
    await clearSets()
  })

  it('keeps draft and published active independent — staging a set draft-active does not disturb the live set', async () => {
    const aIcon = await uploadIcon(payload, 'lane-a', 'M4 12h16')
    const bIcon = await uploadIcon(payload, 'lane-b', 'M5 13l4 4L19 7')
    const aSvg = await svgOf(payload, aIcon.id)
    const bSvg = await svgOf(payload, bIcon.id)

    // Set A: published-active (the live set).
    await payload.create({
      collection: 'iconSet',
      data: { title: 'A', active: true, _status: 'published', iconsArray: [{ name: 'x', icon: aIcon.id }] },
    })
    // Set B: active but saved as a DRAFT (staged, not yet live).
    const b = await payload.create({
      collection: 'iconSet',
      data: { title: 'B', active: true, iconsArray: [{ name: 'x', icon: bIcon.id }] },
      draft: true,
    })

    expect(await resolveName(payload, 'x', false)).toBe(aSvg) // published frontend: still the live set
    expect(await resolveName(payload, 'x', true)).toBe(bSvg) // draft preview: the staged set

    // Publish B — the swap goes live and A is deactivated.
    await payload.update({ collection: 'iconSet', id: b.id, data: { active: true, _status: 'published' } })
    expect(await resolveName(payload, 'x', false)).toBe(bSvg)
    await clearSets()
  })

  it('recordIconMiss upserts: creates then increments with bumped timestamps', async () => {
    await payload.db.deleteMany({ collection: 'iconRequest', req: await createLocalReq({}, payload), where: {} })

    await recordIconMiss(payload, 'phantom')
    let rows = await payload.find({ collection: 'iconRequest', where: { name: { equals: 'phantom' } } })
    expect(rows.totalDocs).toBe(1)
    const first = rows.docs[0] as { count?: number; firstRequestedAt?: string }
    expect(first.count).toBe(1)

    await recordIconMiss(payload, 'phantom')
    rows = await payload.find({ collection: 'iconRequest', where: { name: { equals: 'phantom' } } })
    expect(rows.totalDocs).toBe(1) // upsert, not a second row
    const second = rows.docs[0] as { count?: number; firstRequestedAt?: string }
    expect(second.count).toBe(2)
    expect(second.firstRequestedAt).toBe(first.firstRequestedAt) // first-seen preserved
  })
})

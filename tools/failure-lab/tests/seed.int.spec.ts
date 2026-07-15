import { rm } from 'node:fs/promises'
import config from '@payload-config'
import { defineSeed, seed, SeedRunError, SeedValidationError } from '@pro-laico/payload-seed'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { flags, resetFlags } from '@/flags'
import { clearLogs, warnMessages } from '@/logCapture'

// Failure-mode harness: boots the real config against a temp SQLite DB and drives the REAL seed
// engine down every failure path on purpose. Each test asserts the failure (a) actually fires
// (we usually only test success — assumptions about "it'll error" go unchecked), and (b) reads
// as a legible, identifiable story (seed node `collection:_key`, doc titles, filenames — never a
// bare generated id). Every observed message also lands in a printed legibility report, so
// `pnpm test` doubles as an eyeball pass over the actual error text.

let payload: Payload

const report: Array<{ scenario: string; lines: string[] }> = []
const record = (scenario: string, ...lines: string[]) => report.push({ scenario, lines })

/** Run the seed and expect it to reject with `cls`; returns the typed error for assertions. */
async function expectSeedError<T extends Error>(cls: new (...args: never[]) => T, definitions: unknown[]): Promise<T> {
  try {
    await seed({ payload, options: { definitions: definitions as never } })
  } catch (e) {
    expect(e).toBeInstanceOf(cls)
    return e as T
  }
  throw new Error('expected the seed to fail, but it succeeded')
}

beforeAll(async () => {
  await rm('.vitest.db', { force: true })
  await rm('media', { recursive: true, force: true }) // uploads dir — stale files would dedupe-suffix filenames
  payload = await getPayload({ config })
})

afterAll(async () => {
  await (payload as unknown as { destroy?: () => Promise<void> }).destroy?.()
  const out = report.map((r) => `\n─── ${r.scenario} ───\n${r.lines.map((l) => `  ${l}`).join('\n')}`).join('\n')
  console.info(`\n══════ Seed failure legibility report ══════${out}\n`)
})

beforeEach(() => {
  clearLogs()
  resetFlags()
})

describe('validation failures (SeedValidationError, before anything is written)', () => {
  it("defineSeed targets a collection that doesn't exist", async () => {
    const ghosts = defineSeed('ghosts' as never, () => [{ _key: 'g1', title: 'Boo' }] as never)
    const e = await expectSeedError(SeedValidationError, [ghosts])
    expect(e.issues).toHaveLength(1)
    expect(e.issues[0]).toContain("no collection 'ghosts'")
    expect(e.issues[0]).toContain('fix the slug or add the collection')
    record('unknown collection slug', ...e.issues)
  })

  it("defineSeed targets a global that doesn't exist", async () => {
    const bogus = defineSeed('bogus-settings' as never, () => ({ tagline: 'x' }) as never)
    const e = await expectSeedError(SeedValidationError, [bogus])
    expect(e.issues[0]).toContain("no global 'bogus-settings'")
    record('unknown global slug', ...e.issues)
  })

  it('collects EVERY model issue into one report (bad refs, dup keys, unknown fields, misplaced _file)', async () => {
    const badModel = defineSeed(
      'things' as never,
      (({ ref, file }: { ref: (c: string, k: string) => unknown; file: (n: string) => unknown }) => [
        { _key: 'alpha', title: 'Alpha', related: [ref('ghosts', 'casper')] }, // ref → unknown collection
        { _key: 'alpha', title: 'Alpha again' }, // duplicate _key
        { _key: 'beta', title: 'Beta', related: [ref('things', 'nope')], bogusField: true }, // ref → missing _key + unknown field
        { _key: 'gamma', title: 'Gamma', _file: file('ok.txt') }, // _file on a non-upload collection
      ]) as never,
    )
    const e = await expectSeedError(SeedValidationError, [badModel])
    const all = e.issues.join('\n')
    expect(all).toContain("ref('ghosts', 'casper') targets unknown collection 'ghosts'")
    expect(all).toContain("duplicate _key 'alpha'")
    expect(all).toContain("no seeded 'things' doc has _key 'nope'")
    expect(all).toContain("unknown field 'bogusField'")
    expect(all).toContain("_file set, but 'things' is not an upload collection")
    expect(e.issues.length).toBeGreaterThanOrEqual(5) // ALL collected in one throw, not fail-fast
    record('combined bad model (all issues in one throw)', ...e.issues)
  })
})

describe('skipped definitions', () => {
  it('custom.seedDisabled skips with the reason, and optional refs into the skip are dropped with a story', async () => {
    const flaky = defineSeed('flaky' as never, () => [{ _key: 'f1', title: 'Flaky One' }] as never)
    const hopeful = defineSeed(
      'things' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [
        { _key: 'hopeful', title: 'Hopeful Thing', flakyRef: ref('flaky', 'f1') },
      ]) as never,
    )
    const result = await seed({ payload, options: { definitions: [flaky, hopeful] as never } })

    expect(result.skipped).toEqual([{ slug: 'flaky', reason: 'FLAKY_API_KEY is not set (simulated missing credentials)' }])
    const warns = warnMessages()
    expect(warns.some((w) => w.includes("skipping 'flaky': FLAKY_API_KEY is not set"))).toBe(true)
    expect(warns.some((w) => w.includes("dropping entire field 'flakyRef' on things:hopeful"))).toBe(true)
    // The doc still seeds — just without the dropped field.
    expect(await payload.find({ collection: 'things' as never, limit: 0 }).then((r) => r.totalDocs)).toBe(1)
    record('custom.seedDisabled skip + optional-ref drop', ...warns)
  })

  it('a REQUIRED ref into a skipped definition is a hard, named error', async () => {
    const chickens = defineSeed(
      'chickens' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [{ _key: 'c1', name: 'Henrietta', egg: ref('eggs', 'e1') }]) as never,
      { disabled: 'chickens are on strike (simulated)' },
    )
    const eggs = defineSeed(
      'eggs' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [{ _key: 'e1', name: 'First Egg', chicken: ref('chickens', 'c1') }]) as never,
    )
    const e = await expectSeedError(SeedValidationError, [chickens, eggs])
    expect(e.issues[0]).toContain('eggs:e1.chicken: required')
    expect(e.issues[0]).toContain('targets a skipped definition (chickens are on strike (simulated))')
    record('required ref → skipped definition', ...e.issues)
  })

  it('running with no definitions warns instead of silently doing nothing', async () => {
    const result = await seed({ payload })
    expect(result.created).toEqual({})
    expect(warnMessages().some((w) => w.includes('no seed definitions'))).toBe(true)
    record('no definitions', ...warnMessages())
  })
})

describe('dependency-graph failures', () => {
  it('a cycle of required-only refs is a hard error naming the cycle', async () => {
    const chickens = defineSeed(
      'chickens' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [{ _key: 'c1', name: 'Henrietta', egg: ref('eggs', 'e1') }]) as never,
    )
    const eggs = defineSeed(
      'eggs' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [{ _key: 'e1', name: 'First Egg', chicken: ref('chickens', 'c1') }]) as never,
    )
    const e = await expectSeedError(Error, [chickens, eggs])
    expect(e.message).toContain('dependency cycle detected')
    expect(e.message).toMatch(/(chickens:c1|eggs:e1)/) // names the actual docs in the cycle
    expect(e.message).toContain('make one optional to break it')
    record('required-only ref cycle', e.message)
  })
})

describe('runtime failures (SeedRunError — mid-run writes that die)', () => {
  it('a missing _file warns with the searched dirs, then the create fails NAMING the seed node', async () => {
    const media = defineSeed(
      'media' as never,
      (({ file }: { file: (n: string) => unknown }) => [{ _key: 'missing', _file: file('does-not-exist.jpg'), alt: 'Never uploads' }]) as never,
    )
    const e = await expectSeedError(SeedRunError, [media])
    const warns = warnMessages()
    expect(warns.some((w) => w.includes("_file 'does-not-exist.jpg' not found") && w.includes('Searched:'))).toBe(true)
    expect(e.message).toContain("creating 'media:missing'")
    record('missing _file', ...warns, e.message)
  })

  it('a create that fails validation names the seed node AND the field-level reason', async () => {
    const things = defineSeed('things' as never, (() => [{ _key: 'bad', title: 'Bad Thing', status: 'boom' }]) as never)
    const e = await expectSeedError(SeedRunError, [things])
    expect(e.message).toContain("creating 'things:bad'")
    expect(e.message).toContain('status') // the offending field, not just "field invalid"
    expect(e.message).toContain('may not be "boom"') // the validate()'s own words survive the wrapping
    record('create fails validation', e.message)
  })

  it('a failing deferred-field second pass names the node.field being set', async () => {
    const things = defineSeed(
      'things' as never,
      (({ ref }: { ref: (c: string, k: string) => unknown }) => [
        { _key: 'a', title: 'Thing A', related: [ref('things', 'b')] },
        { _key: 'b', title: 'Thing B', related: [ref('things', 'a')] },
      ]) as never,
    )
    flags.failThingUpdates = true
    const e = await expectSeedError(SeedRunError, [things])
    expect(e.message).toMatch(/setting deferred field 'things:(a|b)\.related'/)
    expect(e.message).toContain('simulated: things are locked after create')
    record('deferred-field second pass fails', e.message)
  })

  it('a failing global update names the global and the reason', async () => {
    const settings = defineSeed('settings' as never, (() => ({ tagline: 'boom' })) as never)
    const e = await expectSeedError(SeedRunError, [settings])
    expect(e.message).toContain("updating global 'settings'")
    expect(e.message).toContain('may not be "boom"')
    record('global update fails', e.message)
  })

  it("an un-clearable doc warns with the doc's HUMAN label (filename/title), not just a raw id", async () => {
    const media = defineSeed(
      'media' as never,
      (({ file }: { file: (n: string) => unknown }) => [{ _key: 'ok', _file: file('ok.txt'), alt: 'A fine file' }]) as never,
    )
    // First run seeds normally; the second must clear it — with deletes simulated as failing.
    await seed({ payload, options: { definitions: [media] as never } })
    clearLogs()
    flags.lockMediaDeletes = true
    await seed({ payload, options: { definitions: [media] as never } })

    const warn = warnMessages().find((w) => w.includes('could not clear'))
    expect(warn).toBeTruthy()
    expect(warn).toContain("in 'media'")
    expect(warn).toMatch(/"ok(-\d+)?\.txt"/) // the human label resolved from the doc, not a bare id
    expect(warn).toContain('simulated storage outage: delete rejected') // the actual cause
    expect(warn).toContain('STALE docs') // tells the operator what state they're in + what to do
    record('un-clearable doc (partial wipe)', warn ?? '(no warning captured!)')
  })
})

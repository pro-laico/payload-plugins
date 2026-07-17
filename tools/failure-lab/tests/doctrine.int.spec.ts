import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
import { fontsPlugin, readFontsMarker } from '@pro-laico/payload-fonts'
import { iconsPlugin, readIconsMarker } from '@pro-laico/payload-icons'
import { imagesPlugin, readImagesMarker } from '@pro-laico/payload-images'
import { muxVideoPlugin, readMuxMarker } from '@pro-laico/payload-mux'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Config, Plugin, SanitizedConfig } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootLab, type LabBoot } from '@/boot'
import { createReport } from './report'

// The handle-flows-in doctrine, made structural instead of a review rule:
//   1. No plugin may stash config/instances on globalThis — the banned `Symbol.for` slots
//      must not exist after a full multi-plugin boot.
//   2. No package src may call getPayload() (bin/ CLIs excepted — they ARE the process
//      boot) or self-resolve the app config via the '@payload-config' alias.
// A regression in any package fails here, not in a consumer's production logs.

const record = createReport('doctrine')

/** The globalThis slots the 2026-07 refactor deleted — existence after boot is a regression. */
const BANNED_SLOTS = ['pro-laico.payload-config', 'pro-laico.payload-revalidate.state', 'pro-laico.payload-icons.iconSetSlug']

let lab: LabBoot

beforeAll(async () => {
  lab = await bootLab({
    plugins: [seedPlugin(), iconsPlugin(), imagesPlugin(), revalidatePlugin({ options: { observe: true, prefix: 'lab' } })],
  })
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
})

describe('no config/state stashes on globalThis', () => {
  it('the banned slots stay empty after a full multi-plugin boot (apply + onInit)', () => {
    const slot = globalThis as Record<symbol, unknown>
    for (const name of BANNED_SLOTS) {
      expect(slot[Symbol.for(name)], `Symbol.for('${name}') should not exist`).toBeUndefined()
    }
    record('banned globalThis slots after boot', `all empty: ${BANNED_SLOTS.join(', ')}`)
  })
})

// The config contract, made structural instead of a review rule. See the ADR "The plugin config
// contract: one shape, one merge, no extendCollection".
//   R1. `collections` is per-collection config — one key per collection, one axis per key.
//   R2. Every override is a `Partial<CollectionConfig>`, not a bespoke allowlist.
//   R3. One merge algorithm, one implementation (tools/plugin-kit, vendored into src/_kit).
//   R4. `Resolved<X>` mirrors `X` — enforced by each package's own typecheck, not reachable here.
// A Plugin is (config) => config, so all of this runs at apply time, with no database.

// `db` and `secret` are required by the type and never touched — nothing here boots.
const bareConfig = (): Config => ({
  db: sqliteAdapter({ client: { url: ':memory:' } }),
  secret: 'conformance',
  collections: [],
  globals: [],
  endpoints: [],
})

// The read<X>Marker helpers take a SanitizedConfig; apply time only ever has an unsanitized
// Config, and the marker sits on `custom` either way. This cast is what keeps the contract
// checkable without booting a database per plugin.
const applied = (plugin: Plugin): SanitizedConfig => plugin(bareConfig()) as unknown as SanitizedConfig

const slugsOf = (config: SanitizedConfig): string[] => (config.collections ?? []).map((c) => c.slug)

const ALL_PLUGINS: { pkg: string; off: Plugin }[] = [
  { pkg: 'payload-images', off: imagesPlugin({ enabled: false }) },
  { pkg: 'payload-icons', off: iconsPlugin({ enabled: false }) },
  { pkg: 'payload-fonts', off: fontsPlugin({ enabled: false }) },
  { pkg: 'payload-mux', off: muxVideoPlugin({ enabled: false }) },
  { pkg: 'payload-seed', off: seedPlugin({ enabled: false }) },
  { pkg: 'payload-revalidate', off: revalidatePlugin({ enabled: false }) },
  { pkg: 'payload-dev-tools', off: devToolsPlugin({ enabled: false }) },
]

/** Each plugin's own collection renamed via `collections.<key>.slug`, and the marker field that has
 * to follow. The marker is the published answer to "which slug did you register?" — dev-tools and
 * every consumer read it, so a marker that lags the rename is a broken rename. */
type Rename = {
  pkg: string
  from: string
  to: string
  apply: () => SanitizedConfig
  markerSlug: (c: SanitizedConfig) => string | null | undefined
}

const RENAMEABLE: Rename[] = [
  {
    pkg: 'payload-mux',
    from: 'mux-video',
    to: 'lab-video',
    apply: () => applied(muxVideoPlugin({ collections: { muxVideo: { slug: 'lab-video' } } })),
    markerSlug: (c) => readMuxMarker(c)?.muxVideoSlug,
  },
  {
    pkg: 'payload-images',
    from: 'images',
    to: 'lab-media',
    apply: () => applied(imagesPlugin({ collections: { images: { slug: 'lab-media' } } })),
    markerSlug: (c) => readImagesMarker(c)?.sourceSlug,
  },
  {
    pkg: 'payload-icons',
    from: 'icon',
    to: 'lab-glyph',
    apply: () => applied(iconsPlugin({ collections: { icon: { slug: 'lab-glyph' } } })),
    markerSlug: (c) => readIconsMarker(c)?.iconSlug,
  },
  {
    pkg: 'payload-fonts',
    from: 'font',
    to: 'lab-typeface',
    apply: () => applied(fontsPlugin({ collections: { font: { slug: 'lab-typeface' } } })),
    markerSlug: (c) => readFontsMarker(c)?.fontSlug,
  },
]

// Every plugin that registers a `config.bin` entry builds its path with the kit's binScriptPath,
// which picks .ts or .js off the CALLER's import.meta.url — the workspace runs src/*.ts, a published
// install runs dist/*.js. Get it wrong and nothing fails at build time: the command is just missing
// when someone runs it. Asserting the file is actually there is the only thing that catches that.
describe('config contract: every registered bin script exists on disk', () => {
  const BIN_PLUGINS: { pkg: string; apply: () => SanitizedConfig }[] = [
    { pkg: 'payload-images', apply: () => applied(imagesPlugin()) },
    { pkg: 'payload-fonts', apply: () => applied(fontsPlugin()) },
    { pkg: 'payload-seed', apply: () => applied(seedPlugin()) },
    { pkg: 'payload-revalidate', apply: () => applied(revalidatePlugin()) },
  ]

  it.each(BIN_PLUGINS)('$pkg resolves each bin scriptPath to a real file', ({ apply }) => {
    const bins = apply().bin ?? []
    expect(bins.length).toBeGreaterThan(0)
    for (const b of bins) {
      expect(existsSync(b.scriptPath), `${b.key} -> ${b.scriptPath}`).toBe(true)
    }
  })

  it('records the bin sweep', () => {
    const all = BIN_PLUGINS.flatMap(({ apply }) => (apply().bin ?? []).map((b) => b.key))
    record('bin scriptPath resolution', `${all.length} bins resolve to real files: ${all.join(', ')}`)
  })
})

describe('config contract: enabled false registers nothing', () => {
  it.each(ALL_PLUGINS)('$pkg adds no collections, globals, or endpoints when disabled', ({ off }) => {
    const config = applied(off)
    expect(config.collections ?? []).toEqual([])
    expect(config.globals ?? []).toEqual([])
    expect(config.endpoints ?? []).toEqual([])
  })
})

describe('config contract: collections.<name>.slug renames, and the plugin follows', () => {
  it.each(RENAMEABLE)('$pkg renames $from to $to, and the marker reports it', ({ from, to, apply, markerSlug }) => {
    const config = apply()
    expect(slugsOf(config)).toContain(to)
    expect(slugsOf(config)).not.toContain(from) // renamed, not duplicated
    expect(markerSlug(config)).toBe(to)
  })

  // The fonts bug, generalized: the collection renames, an internal reference doesn't, and Payload
  // boots into "Field Font has invalid relationship 'font'" — or silently resolves nothing.
  it.each(RENAMEABLE)('$pkg leaves no field pointing at $from after the rename', ({ from, apply }) => {
    const config = apply()
    const refs = JSON.stringify(config.collections ?? [], (_k, v) => (typeof v === 'function' ? undefined : v))
    const stale = new RegExp(`"(relationTo|collection)":"${from}"`).test(refs)
    expect(stale).toBe(false)
  })

  it('records the propagation sweep', () => {
    record('slug rename propagation', `${RENAMEABLE.length} plugins renamed — marker follows, no stale relationTo/collection refs`)
  })
})

describe('static source scan of packages/*/src', () => {
  const packagesDir = fileURLToPath(new URL('../../../packages', import.meta.url))

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
    })

  const allSrc = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((pkg) => sourceFiles(join(packagesDir, pkg.name, 'src')))

  // bin/ CLIs are standalone process boots — the one sanctioned getPayload site.
  const nonBin = allSrc.filter((path) => !path.split(sep).includes('bin'))

  // CODE lines only: JSDoc/line comments legitimately show the app-side wiring these rules
  // mandate (`import { getPayload } from 'payload'`, `from '@payload-config'`) as examples.
  const codeLines = (path: string): string[] =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line.trimStart()))

  it('no package src (outside bin/) imports getPayload as a value', () => {
    const offenders = nonBin.filter((path) =>
      codeLines(path).some((line) => /import\s*\{[^}]*\bgetPayload\b[^}]*\}\s*from\s*'payload'/.test(line) && !/import\s+type\b/.test(line)),
    )
    expect(offenders).toEqual([])
    record('getPayload value-imports outside bin/', `scanned ${nonBin.length} files — none`)
  })

  it("no package src stashes on the banned slots or self-resolves '@payload-config'", () => {
    const offenders = nonBin.filter((path) =>
      codeLines(path).some((line) => BANNED_SLOTS.some((name) => line.includes(`Symbol.for('${name}')`)) || line.includes("'@payload-config'")),
    )
    expect(offenders).toEqual([])
    record("banned Symbol.for slots / '@payload-config' imports", `scanned ${nonBin.length} files — none`)
  })

  // R3: one merge algorithm, one implementation. The src/_kit copies are generated from
  // tools/plugin-kit and guarded by `pnpm kit:check`. A hand-rolled merge anywhere else is how the
  // four copies drifted apart in the first place — and one of them losing the slug guard WAS the
  // payload-fonts rename bug.
  it('no package re-implements something the vendored kit owns', () => {
    const outsideKit = allSrc.filter((path) => !path.split(sep).includes('_kit'))
    // Every export the kit owns. A local redefinition is how the four merge copies drifted apart in
    // the first place — one of them losing the slug guard, which WAS the payload-fonts rename bug.
    const owned =
      /\b(const|function)\s+(merge(Collection|Global|Hooks|Select)|namedFields|assertNoFieldCollisions|asSlug|isRecord|authd|anyone|binScriptPath)\b/
    const offenders = outsideKit.filter((path) => codeLines(path).some((line) => owned.test(line)))
    expect(offenders).toEqual([])
    record('kit-owned helpers redefined outside src/_kit', `scanned ${outsideKit.length} files — none`)
  })
})

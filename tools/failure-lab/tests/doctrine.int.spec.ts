import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { imagesPlugin } from '@pro-laico/payload-images'
import { revalidatePlugin } from '@pro-laico/payload-revalidate'
import { seedPlugin } from '@pro-laico/payload-seed'
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
    plugins: [seedPlugin(), iconsPlugin(), imagesPlugin(), revalidatePlugin({ observe: true, prefix: 'lab' })],
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
})

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadIconUsageManifest } from '../../src/scan/load.js'
import { pickUsageManifest } from '../../src/scan/pick.js'
import { scanIconUsagesLive } from '../../src/scan/live.js'
import type { IconUsageManifest } from '../../src/types/index.js'

const manifest = (names: string[]): IconUsageManifest => ({
  version: 1,
  generatedAt: '2026-07-16T00:00:00.000Z',
  names,
  usages: names.map((name) => ({ name, file: 'src/page.tsx', line: 1, column: 1 })),
})

describe('pickUsageManifest', () => {
  it('prefers the live scan when it found names', () => {
    const live = manifest(['arrow-right'])
    expect(pickUsageManifest(live, manifest(['stale']))).toBe(live)
  })

  // The bug: a live scan that looked in the wrong place returns an empty-but-truthy manifest, which
  // silently shadowed the CLI's manifest and left the panel reporting "0 of 0 … All present ✅".
  it('falls back to the stored manifest when the live scan found nothing', () => {
    const stored = manifest(['arrow-right', 'check', 'close'])
    expect(pickUsageManifest(manifest([]), stored)).toBe(stored)
  })

  it('falls back when there is no live scan at all (production)', () => {
    const stored = manifest(['arrow-right'])
    expect(pickUsageManifest(null, stored)).toBe(stored)
  })

  it('reports nothing rather than an empty truth when neither source found names', () => {
    expect(pickUsageManifest(manifest([]), null)).toBeNull()
    expect(pickUsageManifest(null, null)).toBeNull()
  })

  it('keeps an empty stored manifest — a CLI scan that ran and found none is real information', () => {
    const stored = manifest([])
    expect(pickUsageManifest(manifest([]), stored)).toBe(stored)
  })
})

// The reported bug, end to end through the real scanner and the real loader: the panel showed
// "0 of 0 names requested in code are defined here. All present ✅" while the manifest on disk had
// the names all along.
describe('the panel’s sources, wired the way iconUsagePanel wires them', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'icon-pick-'))
    // The app's icons live somewhere the live scan's hardcoded `src` / `app` roots don't reach —
    // the same shape as an aliased tag or a cwd that isn't the app root.
    mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
    writeFileSync(join(dir, 'packages', 'web', 'page.tsx'), '<Icon name="arrow-right" /><Icon name="check" /><Icon name="close" />')
    // What `npx payload-icons-scan` wrote, pointed at the right root.
    const cli = scanIconUsagesLive({ cwd: dir, roots: ['packages/web'] })
    writeFileSync(join(dir, 'icon-usage-manifest.json'), JSON.stringify(cli))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('reports the CLI manifest’s names when the live scan cannot see the code', () => {
    const live = scanIconUsagesLive({ cwd: dir }) // defaults to src/app — finds nothing here
    expect(live.names).toEqual([]) // empty, but truthy: this is what silently won before
    const stored = loadIconUsageManifest(undefined, dir)
    expect(stored?.names).toEqual(['arrow-right', 'check', 'close'])

    const picked = pickUsageManifest(live, stored)
    expect(picked?.names).toEqual(['arrow-right', 'check', 'close']) // 3 of 3, not 0 of 0
  })
})

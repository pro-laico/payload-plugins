import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scanIconUsagesLive } from './live'

describe('scanIconUsagesLive', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'icon-live-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'page.tsx'),
      ['<Icon name="arrow-right" />', "<Icon name={'check'} />", '<Icon name={slug} />', '<NotIcon name="skip" />'].join('\n'),
    )
    // Ignored dir — must not be scanned.
    mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'x', 'y.tsx'), '<Icon name="ignored" />')
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('finds literal names, skips dynamic + other components + ignored dirs', () => {
    const m = scanIconUsagesLive({ cwd: dir, roots: ['.'] })
    expect(m.names).toEqual(['arrow-right', 'check']) // dynamic name={slug}, <NotIcon>, node_modules all excluded
    expect(m.usages.every((u) => u.file === 'src/page.tsx')).toBe(true)
  })

  it('honors a custom component list', () => {
    const m = scanIconUsagesLive({ cwd: dir, roots: ['src'], components: ['NotIcon'] })
    expect(m.names).toEqual(['skip'])
  })

  it('returns an empty manifest when roots are missing (no throw)', () => {
    expect(scanIconUsagesLive({ cwd: dir, roots: ['does-not-exist'] }).names).toEqual([])
  })
})

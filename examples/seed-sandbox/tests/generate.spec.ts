import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateSeedTypes } from '@pro-laico/payload-seed'
import { afterAll, describe, expect, it } from 'vitest'

// Write to the OS temp dir so the generated file never collides with the committed
// src/seed.generated.ts (two SeedRegistry augmentations in the project would conflict).
const OUT = join(tmpdir(), `seed-sandbox-${process.pid}.generated.ts`)

afterAll(async () => {
  await rm(OUT, { force: true })
})

// The augmentation block is path-independent (only the barrel imports differ by location),
// so drift detection compares just that block.
const registryBlock = (s: string) => s.slice(s.indexOf('declare module'), s.indexOf('export const'))

describe('generateSeedTypes', () => {
  it('extracts collection/global/asset keys from the seed files', async () => {
    const result = await generateSeedTypes({ out: OUT })
    expect(result.collections).toEqual({ posts: ['launch'], services: ['consulting', 'implementation'] })
    expect(result.globals).toEqual(['site-settings'])
    expect(result.assets).toEqual(['logo', 'post', 'serviceA', 'serviceB'])

    const content = await readFile(OUT, 'utf8')
    expect(content).toContain("'services': 'consulting' | 'implementation'")
    expect(content).toContain('export const definitions')
  })

  it('matches the committed src/seed.generated.ts (regen is up to date)', async () => {
    await generateSeedTypes({ out: OUT })
    const [generated, committed] = await Promise.all([readFile(OUT, 'utf8'), readFile('src/seed.generated.ts', 'utf8')])
    expect(registryBlock(generated)).toBe(registryBlock(committed))
  })
})

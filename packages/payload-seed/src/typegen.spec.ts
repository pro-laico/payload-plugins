import { describe, expect, it } from 'vitest'
import { defineAssets, defineGlobalSeed, defineSeed } from './defineSeed'
import { buildSeedRegistry } from './typegen'

describe('buildSeedRegistry', () => {
  const definitions = [
    defineAssets({ hero: { file: 'hero.jpg' }, logo: { file: 'logo.jpg' } }),
    defineSeed('services' as never, () => [{ _key: 'consulting' }, { _key: 'implementation' }] as never),
    defineSeed('posts' as never, () => [{ _key: 'launch' }] as never),
    defineGlobalSeed('site-settings' as never, () => ({}) as never),
  ]

  it('augments SeedRegistry with sorted collection/global/asset key unions', () => {
    const out = buildSeedRegistry(definitions, '@pro-laico/payload-seed')
    expect(out).toContain("declare module '@pro-laico/payload-seed'")
    expect(out).toContain("'posts': 'launch'")
    expect(out).toContain("'services': 'consulting' | 'implementation'")
    expect(out).toContain("globals: 'site-settings'")
    expect(out).toContain("assets: 'hero' | 'logo'")
  })

  it('emits `never` for empty groups', () => {
    const out = buildSeedRegistry([defineSeed('services' as never, () => [{ _key: 'a' }] as never)])
    expect(out).toContain('globals: never')
    expect(out).toContain('assets: never')
  })
})

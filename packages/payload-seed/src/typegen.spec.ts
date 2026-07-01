import { describe, expect, it } from 'vitest'
import { defineCollectionSeed, defineGlobalSeed } from './defineCollectionSeed'
import { buildSeedRegistry } from './typegen'

describe('buildSeedRegistry', () => {
  const definitions = [
    defineCollectionSeed('services' as never, () => [{ _key: 'consulting' }, { _key: 'implementation' }] as never),
    defineCollectionSeed('posts' as never, () => [{ _key: 'launch' }] as never),
    defineGlobalSeed('site-settings' as never, () => ({}) as never),
  ]

  it('augments SeedRegistry with sorted collection/global key unions', () => {
    const out = buildSeedRegistry(definitions, '@pro-laico/payload-seed')
    expect(out).toContain("declare module '@pro-laico/payload-seed'")
    expect(out).toContain("'posts': 'launch'")
    expect(out).toContain("'services': 'consulting' | 'implementation'")
    expect(out).toContain("globals: 'site-settings'")
    expect(out).not.toContain('assets')
    expect(out).not.toContain('SeedProviders')
  })

  it('emits `never` for empty globals', () => {
    const out = buildSeedRegistry([defineCollectionSeed('services' as never, () => [{ _key: 'a' }] as never)])
    expect(out).toContain('globals: never')
  })
})

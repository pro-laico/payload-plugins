import type { Config, Endpoint } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { devToolsPlugin } from '../src/plugin'
import type { DevRegion } from '../src/types'

const apply = (config: Partial<Config> = {}, options: Parameters<typeof devToolsPlugin>[0] = {}): Config =>
  devToolsPlugin({ enabled: true, ...options })(config as Config) as Config

describe('devToolsPlugin', () => {
  it('registers the dev endpoints without dropping existing ones', () => {
    const existing: Endpoint = { path: '/mine', method: 'get', handler: async () => new Response(null) }
    const endpoints = apply({ endpoints: [existing] }).endpoints ?? []
    expect(endpoints.map((e) => e.path)).toEqual(['/mine', '/dev', '/dev/stage', '/dev/region', '/dev/draft', '/dev/icons/activate'])
  })

  // Vitest runs with NODE_ENV=test, so the default gate is closed here — the endpoints and the
  // marker are never registered rather than registering and 404ing per request.
  it('registers nothing outside development by default', () => {
    const existing: Endpoint = { path: '/mine', method: 'get', handler: async () => new Response(null) }
    const config = devToolsPlugin()({ endpoints: [existing], custom: { other: 1 } } as Partial<Config> as Config) as Config
    expect(config.endpoints?.map((e) => e.path)).toEqual(['/mine'])
    expect(config.custom).toEqual({ other: 1 })
  })

  it('honors an explicit enabled: false even in development', () => {
    const config = devToolsPlugin({ enabled: false })({ custom: {} } as Config) as Config
    expect(config.endpoints).toBeUndefined()
    expect(config.custom?.payloadDevTools).toBeUndefined()
  })

  it('marks config.custom.payloadDevTools (with the resolved devRoute) and preserves existing custom entries', () => {
    const config = apply({ custom: { other: 1 } })
    expect(config.custom).toMatchObject({ other: 1, payloadDevTools: { options: { enabled: true }, devRoute: '/dev' } })
    expect(apply({}, { options: { devRoute: '/lab' } }).custom).toMatchObject({ payloadDevTools: { devRoute: '/lab' } })
  })

  it('marks the resolved regions, and lets an app replace the list', () => {
    const marker = apply({}).custom?.payloadDevTools
    expect(marker.regions.map((r: { code: string }) => r.code)).toEqual(['DE', 'FR', 'GB', 'CH', 'US', 'US-CA', 'BR', 'CA', 'JP'])

    const custom: DevRegion[] = [{ code: 'NZ', label: 'New Zealand', regime: 'none', consent: 'none' }]
    expect(apply({}, { options: { regions: custom } }).custom?.payloadDevTools.regions).toEqual(custom)
  })

  it("wraps onInit (config stash) without dropping the app's own onInit", async () => {
    const appOnInit = vi.fn()
    const config = apply({ onInit: appOnInit })
    await config.onInit?.({ config: {} } as never)
    expect(appOnInit).toHaveBeenCalledOnce()
  })
})

// `enabled` is a kill switch, not an override: development-only tools that a deployed build could
// be told to serve are how a diagnostics page ends up publishing the build machine's counts.
describe('devToolsPlugin — the production clamp', () => {
  it('registers nothing under NODE_ENV=production, even with enabled: true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const config = devToolsPlugin({ enabled: true })({ custom: {} } as Config) as Config
    expect(config.endpoints).toBeUndefined()
    expect(config.custom?.payloadDevTools).toBeUndefined()
    vi.unstubAllEnvs()
  })

  it('still honors enabled: true outside production, so tests and harnesses can opt in', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(apply({}).custom?.payloadDevTools).toBeDefined()
    vi.unstubAllEnvs()
  })
})

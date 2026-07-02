import type { Config, Endpoint } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { devToolsPlugin } from './plugin'

const apply = (config: Partial<Config> = {}, options: Parameters<typeof devToolsPlugin>[0] = {}): Config =>
  devToolsPlugin(options)(config as Config) as Config

describe('devToolsPlugin', () => {
  it('registers the dev endpoints without dropping existing ones', () => {
    const existing: Endpoint = { path: '/mine', method: 'get', handler: async () => new Response(null) }
    const endpoints = apply({ endpoints: [existing] }).endpoints ?? []
    expect(endpoints.map((e) => e.path)).toEqual(['/mine', '/dev', '/dev/stage', '/dev/icons/activate'])
  })

  it('marks config.custom.payloadDevTools (with the resolved devRoute) and preserves existing custom entries', () => {
    const config = apply({ custom: { other: 1 } })
    expect(config.custom).toMatchObject({ other: 1, payloadDevTools: { options: {}, devRoute: '/dev' } })
    expect(apply({}, { devRoute: '/lab' }).custom).toMatchObject({ payloadDevTools: { devRoute: '/lab' } })
  })

  it("wraps onInit (config stash) without dropping the app's own onInit", async () => {
    const appOnInit = vi.fn()
    const config = apply({ onInit: appOnInit })
    await config.onInit?.({ config: {} } as never)
    expect(appOnInit).toHaveBeenCalledOnce()
  })
})

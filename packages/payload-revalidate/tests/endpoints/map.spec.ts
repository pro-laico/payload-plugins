import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../../src/lib/observe/registry'
import { stashInspect } from '../../src/lib/inspect'
import { stashState } from '../../src/lib/state'
import { createMapEndpoints } from '../../src/endpoints/map'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }))

const inspection = {
  graph: { collections: [], globals: [], edges: [] },
  prefix: '',
  observing: true,
  rules: [],
  settings: {},
  getters: [],
  reads: [],
  events: [],
}

const call = async (endpoints: ReturnType<typeof createMapEndpoints>, method: 'get' | 'post', body?: unknown, user?: unknown) => {
  const endpoint = endpoints.find((e) => e.method === method)
  const req = { json: async () => body, user } as never
  return (await endpoint?.handler(req)) as Response
}

describe('map endpoints', () => {
  beforeEach(() => {
    stashState({ prefix: '', observe: true })
    stashInspect(() => inspection)
    resetObservations()
    revalidateTag.mockReset()
  })

  it('404s when observation is off', async () => {
    const endpoints = createMapEndpoints({ observe: false })
    expect((await call(endpoints, 'get')).status).toBe(404)
    expect((await call(endpoints, 'post', { tag: 'x' })).status).toBe(404)
  })

  it('GET returns the inspection snapshot', async () => {
    const res = await call(createMapEndpoints({ observe: true }), 'get')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ prefix: '', graph: { edges: [] } })
  })

  it('POST busts one tag and records a manual event', async () => {
    const res = await call(createMapEndpoints({ observe: true }), 'post', { tag: 'posts:42' })
    expect(await res.json()).toEqual({ busted: 'posts:42' })
    expect(revalidateTag).toHaveBeenCalledWith('posts:42')
    expect(getObservations().events[0]).toMatchObject({ source: 'manual', busted: [{ tag: 'posts:42', reason: 'manual' }] })
  })

  it('POST rejects a missing tag', async () => {
    expect((await call(createMapEndpoints({ observe: true }), 'post', {})).status).toBe(400)
  })

  it('production requires an authenticated user even with observe forced on (GET discloses the schema, POST busts arbitrary tags)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const endpoints = createMapEndpoints({ observe: true })
      expect((await call(endpoints, 'get')).status).toBe(404)
      expect((await call(endpoints, 'post', { tag: 'all' })).status).toBe(404)
      expect(revalidateTag).not.toHaveBeenCalled()
      expect((await call(endpoints, 'get', undefined, { id: 1 })).status).toBe(200)
      expect((await call(endpoints, 'post', { tag: 'posts:1' }, { id: 1 })).status).toBe(200)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'

import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { createPresetStatusEndpoint } from '../../../src/endpoints/presets'
import { DEFAULT_PRESET_TEMPLATES } from '../../../src/lib/presets/defaults'
import type { PresetStatusResponse } from '../../../src/types'

const cfg = {
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  templates: DEFAULT_PRESET_TEMPLATES,
  constraints: DEFAULT_CONSTRAINTS,
}

const fakeReq = (opts: { user?: unknown; id?: string; source?: Record<string, unknown> | null; variants?: Record<string, unknown>[] } = {}) => {
  const source = opts.source === undefined ? { id: 'img1', filename: 'a.jpg', presets: [{ template: 'og' }] } : opts.source
  const findByID = source ? vi.fn().mockResolvedValue(source) : vi.fn().mockRejectedValue(new Error('nope'))
  const find = vi.fn().mockImplementation(({ where }: { where?: { and?: [unknown, { cacheKey?: { in?: string[] } }] } }) => {
    const wanted = where?.and?.[1]?.cacheKey?.in ?? []
    return Promise.resolve({ docs: (opts.variants ?? []).filter((v) => typeof v.cacheKey === 'string' && wanted.includes(v.cacheKey)) })
  })
  const payload = { find, findByID, logger: { warn: vi.fn(), error: vi.fn() } } as unknown as Payload
  const req = {
    payload,
    user: 'user' in opts ? opts.user : { id: 'admin' },
    routeParams: { id: opts.id ?? 'img1' },
  } as unknown as PayloadRequest
  return { req, find }
}

const run = async (opts?: Parameters<typeof fakeReq>[0]): Promise<{ status: number; body: PresetStatusResponse }> => {
  const res = await createPresetStatusEndpoint(cfg).handler(fakeReq(opts).req)
  return { status: res.status, body: (await res.json()) as PresetStatusResponse }
}

describe('createPresetStatusEndpoint', () => {
  it('registers get /img/presets/:id', () => {
    const ep = createPresetStatusEndpoint(cfg)
    expect(ep.path).toBe('/img/presets/:id')
    expect(ep.method).toBe('get')
  })

  it('guards: 401 unauthenticated, 400 missing id, 404 unknown source', async () => {
    await expect(run({ user: null })).resolves.toMatchObject({ status: 401 })
    await expect(run({ id: '' })).resolves.toMatchObject({ status: 400 })
    await expect(run({ source: null })).resolves.toMatchObject({ status: 404 })
  })

  it('reports every servable preset (all config templates + custom entries) with a cacheKey', async () => {
    const source = { id: 'img1', filename: 'a.jpg', presets: [{ name: 'hero', width: 1920, format: 'webp' }] }
    const { body } = await run({ source })
    const names = body.presets.map((p) => p.name).sort()
    expect(names).toEqual(['hero', 'og', 'thumbnail'])
    for (const p of body.presets) {
      expect(p.cacheKey).toMatch(/^[0-9a-f]{24}$/)
      expect(p.variantId).toBeUndefined()
    }
  })

  it('attaches the cached variant id + filename when the preset variant exists', async () => {
    const first = await run()
    const ogKey = first.body.presets.find((p) => p.name === 'og')?.cacheKey
    expect(ogKey).toBeTruthy()
    const { body } = await run({ variants: [{ id: 'v9', cacheKey: ogKey, filename: `${ogKey}.jpg` }] })
    expect(body.presets.find((p) => p.name === 'og')).toMatchObject({ variantId: 'v9', filename: `${ogKey}.jpg` })
    expect(body.presets.find((p) => p.name === 'thumbnail')?.variantId).toBeUndefined()
  })

  it('cacheKeys differ per preset and change with the crop identity', async () => {
    const a = await run()
    const b = await run({ source: { id: 'img1', filename: 'a.jpg', presets: [], focalX: 80 } })
    const keysA = new Set(a.body.presets.map((p) => p.cacheKey))
    expect(keysA.size).toBe(a.body.presets.length)
    expect(b.body.presets.find((p) => p.name === 'og')?.cacheKey).not.toBe(a.body.presets.find((p) => p.name === 'og')?.cacheKey)
  })
})

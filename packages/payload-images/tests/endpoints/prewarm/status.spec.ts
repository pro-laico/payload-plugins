import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'

import { DEFAULT_CONSTRAINTS, DEFAULT_WIDTH_LADDER } from '../../../src/lib/transform/params'
import { createPrewarmStatusEndpoint } from '../../../src/endpoints/prewarm'
import type { PrewarmStatusResponse } from '../../../src/types'

const deps = {
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  profilesSlug: 'image-render-profiles',
  strategy: {
    widths: 'srcset' as const,
    builtIns: true,
    learned: true,
    seeds: [{ widths: [800] }],
    onUpload: true,
    autoRun: false as const,
    autoRunLimit: 50,
    queue: 'default',
  },
  formats: ['webp' as const],
  maxVariantsPerImage: 32,
  // Array-pixelStep constraints: an explicit ladder keeps the 'srcset' width axis small and exact.
  constraints: { ...DEFAULT_CONSTRAINTS, widthLadder: DEFAULT_WIDTH_LADDER },
}
const cfg = { deps, taskSlug: 'imagesPrewarm' }

type JobDoc = Record<string, unknown>

const fakeReq = (opts: { user?: unknown; id?: string; source?: Record<string, unknown> | null; jobs?: JobDoc[]; done?: JobDoc[] } = {}) => {
  const source = opts.source === undefined ? { id: 'img1', filename: 'a.jpg', width: 2000, height: 1000, mimeType: 'image/jpeg' } : opts.source
  const findByID = vi.fn().mockImplementation(({ disableErrors }: { disableErrors?: boolean }) => {
    if (source) return Promise.resolve(source)
    if (disableErrors) return Promise.resolve(null)
    return Promise.reject(new Error('not found'))
  })
  const find = vi.fn().mockImplementation(({ collection, where }: { collection: string; where?: { and?: { completedAt?: unknown }[] } }) => {
    if (collection === 'payload-jobs') {
      const wantsCompleted = JSON.stringify(where).includes('"exists":true')
      return Promise.resolve({ docs: wantsCompleted ? (opts.done ?? []) : (opts.jobs ?? []), hasNextPage: false })
    }
    return Promise.resolve({ docs: [], hasNextPage: false })
  })
  const update = vi.fn().mockResolvedValue({})
  const payload = { find, findByID, update, logger: { warn: vi.fn(), error: vi.fn() } } as unknown as Payload
  const req = {
    payload,
    user: 'user' in opts ? opts.user : { id: 'admin' },
    routeParams: { id: opts.id ?? 'img1' },
  } as unknown as PayloadRequest
  return { req, find, findByID, update }
}

const run = async (opts?: Parameters<typeof fakeReq>[0]): Promise<{ status: number; body: PrewarmStatusResponse }> => {
  const { req } = fakeReq(opts)
  const res = await createPrewarmStatusEndpoint(cfg).handler(req)
  return { status: res.status, body: (await res.json()) as PrewarmStatusResponse }
}

describe('createPrewarmStatusEndpoint', () => {
  it('registers get /img/prewarm/:id', () => {
    const ep = createPrewarmStatusEndpoint(cfg)
    expect(ep.path).toBe('/img/prewarm/:id')
    expect(ep.method).toBe('get')
  })

  it('guards: 401 unauthenticated, 400 missing id, 404 unknown source', async () => {
    await expect(run({ user: null })).resolves.toMatchObject({ status: 401 })
    await expect(run({ id: '' })).resolves.toMatchObject({ status: 400 })
    await expect(run({ source: null })).resolves.toMatchObject({ status: 404 })
  })

  it('returns a real dry-run plan with params/format/cacheKey per target', async () => {
    const { body } = await run()
    expect(body.status).toBe('idle')
    expect(body.plan.length).toBeGreaterThan(0)
    expect(body.plan.length).toBeLessThanOrEqual(deps.maxVariantsPerImage)
    for (const item of body.plan) {
      expect(item.format).toBe('webp')
      expect(typeof item.cacheKey).toBe('string')
      expect(item.params.w).toBeGreaterThan(0)
    }
    expect(body.truncated).toBeUndefined()
  })

  it('surfaces truncated when the plan hits maxVariantsPerImage', async () => {
    const tiny = { ...cfg, deps: { ...deps, maxVariantsPerImage: 2 } }
    const { req } = fakeReq()
    const res = await createPrewarmStatusEndpoint(tiny).handler(req)
    const body = (await res.json()) as PrewarmStatusResponse
    expect(body.plan).toHaveLength(2)
    expect(body.truncated).toBe(true)
  })

  it('reports skipped (empty plan) for non-raster sources', async () => {
    const { body } = await run({ source: { id: 'img1', filename: 'a.svg', mimeType: 'image/svg+xml' } })
    expect(body).toMatchObject({ status: 'idle', plan: [], skipped: 'non-raster' })
  })

  it('matches pending jobs by input.sourceId in-process (JSON field), mapping waitUntil through', async () => {
    const other = { id: 1, input: { sourceId: 'someone-else' } }
    const mine = { id: 2, input: { sourceId: 'img1' }, waitUntil: '2026-07-14T12:00:00.000Z' }
    const { body } = await run({ jobs: [other, mine] })
    expect(body.status).toBe('queued')
    expect(body.job).toMatchObject({ id: 2, processing: false, waitUntil: '2026-07-14T12:00:00.000Z' })
  })

  it('maps processing: true to running (a fresh heartbeat means the runner is alive)', async () => {
    const { body } = await run({ jobs: [{ id: 2, input: { sourceId: 'img1' }, processing: true, updatedAt: new Date().toISOString() }] })
    expect(body.status).toBe('running')
    expect(body.job).toMatchObject({ processing: true })
  })

  it('sweeps a stale processing job (dead runner) back to runnable and reports it queued', async () => {
    const staleAt = new Date(Date.now() - 6 * 60_000).toISOString()
    const { req, update } = fakeReq({ jobs: [{ id: 2, input: { sourceId: 'img1' }, processing: true, updatedAt: staleAt }] })
    const res = await createPrewarmStatusEndpoint(cfg).handler(req)
    const body = (await res.json()) as PrewarmStatusResponse
    expect(body.status).toBe('queued')
    expect(body.job).toMatchObject({ id: 2, processing: false })
    expect(update).toHaveBeenCalledWith({ collection: 'payload-jobs', id: 2, data: { processing: false }, depth: 0 })
  })

  it('extracts lastRun counters from the succeeded log entry', async () => {
    const done = {
      id: 3,
      input: { sourceId: 'img1' },
      completedAt: '2026-07-14T11:00:00.000Z',
      log: [
        { state: 'failed', output: {} },
        { state: 'succeeded', output: { targets: 3, generated: 3, failed: 0 } },
      ],
    }
    const { body } = await run({ done: [done] })
    expect(body.lastRun).toMatchObject({ completedAt: '2026-07-14T11:00:00.000Z', targets: 3, generated: 3, failed: 0 })
  })
})

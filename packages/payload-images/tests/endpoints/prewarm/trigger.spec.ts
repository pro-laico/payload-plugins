import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'

import { enqueuePrewarmJob } from '../../../src/lib/prewarm/enqueue'
import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { createPrewarmTriggerEndpoint } from '../../../src/endpoints/prewarm'

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('../../../src/lib/prewarm/enqueue', () => ({ enqueuePrewarmJob: vi.fn().mockResolvedValue(undefined) }))

const deps = {
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  profilesSlug: 'image-render-profiles',
  seeds: [],
  formats: ['webp' as const],
  maxVariantsPerImage: 24,
  constraints: DEFAULT_CONSTRAINTS,
}
const cfg = { deps, taskSlug: 'imagesPrewarm', queue: 'warmQ' }
const mockedEnqueue = vi.mocked(enqueuePrewarmJob)

const fakeReq = (opts: { user?: unknown; id?: string; found?: boolean } = {}) => {
  const findByID = opts.found === false ? vi.fn().mockRejectedValue(new Error('nope')) : vi.fn().mockResolvedValue({ id: 'img1' })
  const jobsRun = vi.fn().mockResolvedValue({})
  const payload = { findByID, jobs: { run: jobsRun }, logger: { warn: vi.fn(), error: vi.fn() } } as unknown as Payload
  const req = {
    payload,
    user: 'user' in opts ? opts.user : { id: 'admin' },
    routeParams: { id: opts.id ?? 'img1' },
  } as unknown as PayloadRequest
  return { req, jobsRun }
}

describe('createPrewarmTriggerEndpoint', () => {
  it('registers post /img/prewarm/:id', () => {
    const ep = createPrewarmTriggerEndpoint(cfg)
    expect(ep.path).toBe('/img/prewarm/:id')
    expect(ep.method).toBe('post')
  })

  it('guards: 401 unauthenticated, 400 missing id, 404 unknown source — no enqueue', async () => {
    mockedEnqueue.mockClear()
    for (const [opts, status] of [
      [{ user: null }, 401],
      [{ id: '' }, 400],
      [{ found: false }, 404],
    ] as const) {
      const { req } = fakeReq(opts)
      const res = await createPrewarmTriggerEndpoint(cfg).handler(req)
      expect(res.status).toBe(status)
    }
    expect(mockedEnqueue).not.toHaveBeenCalled()
  })

  it('enqueues an immediate manual run and kicks the queue runner, returning 202', async () => {
    mockedEnqueue.mockClear()
    const { req, jobsRun } = fakeReq()
    const res = await createPrewarmTriggerEndpoint(cfg).handler(req)
    expect(res.status).toBe(202)
    await expect(res.json()).resolves.toEqual({ queued: true })
    expect(mockedEnqueue).toHaveBeenCalledOnce()
    expect(mockedEnqueue.mock.calls[0]?.[1]).toEqual({
      sourceId: 'img1',
      reason: 'manual',
      taskSlug: 'imagesPrewarm',
      queue: 'warmQ',
      waitUntil: false,
    })
    expect(jobsRun).toHaveBeenCalledWith({ queue: 'warmQ' })
  })
})

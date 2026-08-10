import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { prewarmSource } from '../../src/lib/prewarm/prewarmSource'
import { createPrewarmTask, PREWARM_TASK_SLUG } from '../../src/jobs/prewarmTask'
import { DEFAULT_CONSTRAINTS } from '../../src/lib/transform/params'

vi.mock('../../src/lib/prewarm/prewarmSource', () => ({ prewarmSource: vi.fn() }))

const deps = {
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  profilesSlug: 'image-render-profiles',
  strategy: {
    widths: 'srcset' as const,
    builtIns: true,
    learned: true,
    seeds: [],
    onUpload: true,
    autoRun: false as const,
    autoRunLimit: 50,
    queue: 'default',
  },
  formats: ['webp' as const],
  maxVariantsPerImage: 32,
  constraints: DEFAULT_CONSTRAINTS,
}
const req = { payload: {} as Payload }
const mocked = vi.mocked(prewarmSource)

describe('createPrewarmTask', () => {
  const task = createPrewarmTask(deps)

  it('declares the slug, retry policy, and input/output schema', () => {
    expect(task.slug).toBe(PREWARM_TASK_SLUG)
    expect(task.retries).toMatchObject({ attempts: 2, backoff: { type: 'exponential' } })
    expect(task.inputSchema.map((f) => f.name)).toEqual(['sourceId', 'reason'])
  })

  it('returns the run counters as output', async () => {
    mocked.mockResolvedValueOnce({ targets: 5, generated: 4, failed: 1 })
    await expect(task.handler({ input: { sourceId: '1', reason: 'create' }, req })).resolves.toEqual({
      output: { targets: 5, generated: 4, failed: 1 },
    })
    expect(mocked).toHaveBeenCalledWith(req.payload, '1', deps, expect.any(Function))
  })

  it('succeeds (with the skip reason) when the source is gone — retrying cannot help', async () => {
    mocked.mockResolvedValueOnce({ targets: 0, generated: 0, failed: 0, skipped: 'missing' })
    await expect(task.handler({ input: { sourceId: 'gone', reason: 'manual' }, req })).resolves.toMatchObject({
      output: { skipped: 'missing' },
    })
  })

  it('throws on total failure so the retry policy applies', async () => {
    mocked.mockResolvedValueOnce({ targets: 3, generated: 0, failed: 3 })
    await expect(task.handler({ input: { sourceId: '1', reason: 'replace' }, req })).rejects.toThrow(/all 3 variant/)
  })

  describe('heartbeat', () => {
    afterEach(() => vi.useRealTimers())

    const captureHeartbeat = async (job?: {
      id: string | number
    }): Promise<{ beat: () => Promise<void>; update: ReturnType<typeof vi.fn> }> => {
      let beat: (() => Promise<void>) | undefined
      mocked.mockImplementationOnce(async (_payload, _id, _deps, onProgress) => {
        beat = onProgress
        return { targets: 0, generated: 0, failed: 0 }
      })
      const update = vi.fn().mockResolvedValue({})
      await task.handler({ input: { sourceId: '1', reason: 'manual' }, job, req: { payload: { update } as unknown as Payload } })
      if (!beat) throw new Error('prewarmSource did not receive a heartbeat')
      return { beat, update }
    }

    it('bumps the job doc between variants, throttled — so a live run keeps updatedAt fresh', async () => {
      vi.useFakeTimers()
      const { beat, update } = await captureHeartbeat({ id: 'job1' })
      await beat() // inside the throttle window (the claim just bumped updatedAt) — no write
      expect(update).not.toHaveBeenCalled()
      vi.advanceTimersByTime(21_000)
      await beat()
      expect(update).toHaveBeenCalledWith({ collection: 'payload-jobs', id: 'job1', data: { processing: true }, depth: 0 })
      update.mockClear()
      await beat() // throttled again right after a bump
      expect(update).not.toHaveBeenCalled()
    })

    it('is a no-op without a job id (direct/CLI runs) and swallows update failures', async () => {
      vi.useFakeTimers()
      const first = await captureHeartbeat(undefined)
      vi.advanceTimersByTime(21_000)
      await first.beat()
      expect(first.update).not.toHaveBeenCalled()
      const second = await captureHeartbeat({ id: 'job1' })
      vi.advanceTimersByTime(21_000)
      second.update.mockRejectedValueOnce(new Error('db down'))
      await expect(second.beat()).resolves.toBeUndefined()
    })
  })
})

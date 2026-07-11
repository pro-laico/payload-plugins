import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { prewarmSource } from '../../src/lib/prewarm/prewarmSource'
import { createPrewarmTask, PREWARM_TASK_SLUG } from '../../src/jobs/prewarmTask'
import { DEFAULT_CONSTRAINTS } from '../../src/lib/transform/params'

vi.mock('../../src/lib/prewarm/prewarmSource', () => ({ prewarmSource: vi.fn() }))

const deps = {
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  profilesSlug: 'image-render-profiles',
  seeds: [],
  formats: ['webp' as const],
  maxVariantsPerImage: 24,
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
    expect(mocked).toHaveBeenCalledWith(req.payload, '1', deps)
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
})

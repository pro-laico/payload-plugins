import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { kickPrewarmRunner, KICK_TIME_BUDGET_MS, STALE_PROCESSING_MS, UPLOAD_KICK_DELAY_MS } from '../../../src/lib/prewarm/kick'

let captured: Promise<void> | undefined
const afterMock = vi.fn((fn: () => Promise<void>) => {
  captured = fn()
})
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => afterMock(fn) }))

const RAN = { jobStatus: { j1: { status: 'success' } }, remainingJobsFromQueried: 0 }
const DRY = { noJobsRemaining: true, remainingJobsFromQueried: 0 }

const fakePayload = (results: unknown[] = []) => {
  const queue = [...results]
  const run = vi.fn(async () => queue.shift() ?? DRY)
  const update = vi.fn().mockResolvedValue({})
  return { run, update, payload: { update, jobs: { run } } as unknown as Payload }
}

afterEach(() => {
  vi.useRealTimers()
  captured = undefined
  afterMock.mockClear()
  afterMock.mockImplementation((fn: () => Promise<void>) => {
    captured = fn()
  })
})

describe('kickPrewarmRunner', () => {
  it('pulls one job per run so the budget is checked between jobs, until the queue is dry', async () => {
    const { payload, run } = fakePayload([RAN, RAN])
    kickPrewarmRunner(payload, { queue: 'warmQ' })
    await captured
    expect(run).toHaveBeenCalledTimes(3)
    expect(run).toHaveBeenCalledWith({ queue: 'warmQ', limit: 1 })
  })

  it('honors the job limit', async () => {
    const { payload, run } = fakePayload([RAN, RAN, RAN, RAN])
    kickPrewarmRunner(payload, { queue: 'warmQ', limit: 2 })
    await captured
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('stops pulling new jobs once the time budget is spent — never killed mid-batch by maxDuration', async () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue({})
    const run = vi.fn(async () => {
      vi.setSystemTime(Date.now() + KICK_TIME_BUDGET_MS + 1_000)
      return RAN
    })
    const payload = { update, jobs: { run } } as unknown as Payload
    kickPrewarmRunner(payload, { queue: 'warmQ', limit: 50 })
    await captured
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('sweeps stale processing jobs (dead runners) back to runnable before pulling', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    const { payload, update, run } = fakePayload()
    kickPrewarmRunner(payload, { queue: 'warmQ' })
    await captured
    expect(update).toHaveBeenCalledOnce()
    const args = update.mock.calls[0]?.[0]
    expect(args).toMatchObject({ collection: 'payload-jobs', data: { processing: false } })
    expect(args.where.and).toContainEqual({ queue: { equals: 'warmQ' } })
    expect(args.where.and).toContainEqual({ processing: { equals: true } })
    expect(args.where.and).toContainEqual({ completedAt: { exists: false } })
    expect(args.where.and).toContainEqual({
      updatedAt: { less_than: new Date(Date.now() - STALE_PROCESSING_MS).toISOString() },
    })
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(run.mock.invocationCallOrder[0] ?? Infinity)
  })

  it('still pulls jobs when the sweep fails — the sweep is best-effort', async () => {
    const { payload, update, run } = fakePayload([RAN])
    update.mockRejectedValueOnce(new Error('update denied'))
    kickPrewarmRunner(payload, { queue: 'warmQ' })
    await captured
    expect(run).toHaveBeenCalled()
  })

  it('sleeps out delayMs before running, so the coalesced job is due when the run queries', async () => {
    vi.useFakeTimers()
    const { payload, run } = fakePayload([RAN])
    kickPrewarmRunner(payload, { queue: 'warmQ', limit: 10, delayMs: UPLOAD_KICK_DELAY_MS })
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(UPLOAD_KICK_DELAY_MS)
    expect(run).toHaveBeenCalledWith({ queue: 'warmQ', limit: 1 })
  })

  it('skips the kick outside a Next request scope — no detached run to race a process shutdown', async () => {
    afterMock.mockImplementation(() => {
      throw new Error('after called outside request scope')
    })
    const { payload, run, update } = fakePayload([RAN])
    expect(() => kickPrewarmRunner(payload, { queue: 'warmQ', limit: 5 })).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(run).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('swallows runner failures — a kick is best-effort', async () => {
    const update = vi.fn().mockResolvedValue({})
    const run = vi.fn().mockRejectedValue(new Error('runner down'))
    const payload = { update, jobs: { run } } as unknown as Payload
    expect(() => kickPrewarmRunner(payload, { queue: 'warmQ' })).not.toThrow()
    await expect(captured).resolves.toBeUndefined()
  })
})

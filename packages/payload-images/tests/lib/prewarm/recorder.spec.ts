import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { createObservationRecorder } from '../../../src/lib/prewarm/recorder'
import type { ProfileParts, RenderProfileDoc } from '../../../src/types'

const parts = (over: Partial<ProfileParts> = {}): ProfileParts => ({ ratio: '1.778', fit: 'cover', quality: 80, format: 'auto', ...over })

const fakePayload = (existing?: Partial<RenderProfileDoc>) => {
  // `find` serves two callers: the fire-and-forget ratio refresh (has `select`) and the flush's
  // profile lookup (has `where`) — route by shape so tests only assert on the lookup.
  const lookup = vi.fn().mockResolvedValue({ docs: existing ? [{ id: 'rp1', hitCount: 5, widths: null, ...existing }] : [] })
  const find = vi.fn().mockImplementation((args: { select?: unknown }) => (args.select ? Promise.resolve({ docs: [] }) : lookup(args)))
  const create = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockResolvedValue({})
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  return { payload: { find, create, update, logger } as unknown as Payload, lookup, create, update, logger } //EXCUSE: test double — only the members the recorder touches
}

const make = (p: Payload) => createObservationRecorder({ payload: p, profilesSlug: 'image-render-profiles', seedCandidates: [] })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createObservationRecorder', () => {
  it('buffers synchronously and flushes once on the timer — a new profile is created', async () => {
    const { payload, lookup, create } = fakePayload()
    const rec = make(payload)
    rec.observe({ parts: parts(), width: 650 })
    rec.observe({ parts: parts(), width: 650 })
    rec.observe({ parts: parts(), width: 1600 })
    expect(lookup).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(create).toHaveBeenCalledOnce()
    const data = create.mock.calls[0]?.[0]?.data
    expect(data.profileKey).toBe('1.778|cover|80|auto')
    expect(data.hitCount).toBe(3)
    expect(data.widths['650'].n).toBe(2)
    expect(data.widths['1600'].n).toBe(1)
  })

  it('updates an existing profile, accumulating hitCount and merging the histogram', async () => {
    const { payload, update } = fakePayload({ widths: { '650': { n: 10, last: '2026-01-01T00:00:00.000Z' } } })
    const rec = make(payload)
    rec.observe({ parts: parts(), width: 650 })
    await rec.flushNow()
    expect(update).toHaveBeenCalledOnce()
    const data = update.mock.calls[0]?.[0]?.data
    expect(data.hitCount).toBe(6) // 5 existing + 1 buffered
    expect(data.widths['650'].n).toBe(11)
  })

  it('throttles hit-only flushes but flushes a NEW width immediately', async () => {
    const { payload, update, create } = fakePayload({})
    const rec = make(payload)
    rec.observe({ parts: parts(), width: 650 })
    await rec.flushNow()
    expect(update).toHaveBeenCalledTimes(1)

    // Hits on an already-persisted width inside the throttle window: no write.
    rec.observe({ parts: parts(), width: 650 })
    await rec.flushNow()
    expect(update).toHaveBeenCalledTimes(1)

    // A brand-new width: writes despite the throttle.
    rec.observe({ parts: parts(), width: 2400 })
    await rec.flushNow()
    expect(update).toHaveBeenCalledTimes(2)
    expect(create).not.toHaveBeenCalled()
  })

  it('retries as update when the create loses a cross-process race (duplicate key)', async () => {
    const { payload, lookup, create, update } = fakePayload()
    create.mockRejectedValueOnce(Object.assign(new Error('UNIQUE constraint failed: profileKey'), { code: 'SQLITE_CONSTRAINT' }))
    lookup.mockResolvedValueOnce({ docs: [] }).mockResolvedValue({ docs: [{ id: 'rp1', hitCount: 0, widths: null }] })
    const rec = make(payload)
    rec.observe({ parts: parts(), width: 650 })
    await rec.flushNow()
    expect(create).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
  })

  it('evicts the least-observed widths beyond the histogram cap', async () => {
    const big: Record<string, { n: number; last: string }> = {}
    for (let i = 1; i <= 24; i++) big[String(i * 100)] = { n: i, last: '2026-01-01T00:00:00.000Z' }
    const { payload, update } = fakePayload({ widths: big })
    const rec = make(payload)
    rec.observe({ parts: parts(), width: 9999 })
    await rec.flushNow()
    const widths = update.mock.calls[0]?.[0]?.data?.widths
    expect(Object.keys(widths)).toHaveLength(24)
    expect(widths['100']).toBeUndefined() // n=1, evicted
    expect(widths['9999']).toBeDefined()
  })

  it('caps the buffer and never throws when the DB write fails', async () => {
    const { payload, lookup, logger } = fakePayload()
    lookup.mockRejectedValue(new Error('db down'))
    const rec = make(payload)
    for (let i = 0; i < 200; i++) rec.observe({ parts: parts({ quality: (i % 40) * 5 + 40, ratio: `${i}` as never }), width: 100 }) //EXCUSE: synthetic distinct ratios to overflow the buffer
    await expect(rec.flushNow()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled() // buffer cap + flush failure, warned not thrown
  })
})

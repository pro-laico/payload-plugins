import { afterEach, describe, expect, it } from 'vitest'

import { setTransformConcurrency, TransformOverloadError, withTransformLimit } from '../../../src/lib/transform/limit'

const defer = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

afterEach(() => setTransformConcurrency(Number(process.env.IMAGES_TRANSFORM_CONCURRENCY) || 3))

describe('withTransformLimit', () => {
  it('runs at most `limit` transforms concurrently, queueing the rest', async () => {
    setTransformConcurrency(2)
    let active = 0
    let peak = 0
    const gate = defer()
    const tasks = Array.from({ length: 5 }, () =>
      withTransformLimit(async () => {
        active++
        peak = Math.max(peak, active)
        await gate.promise
        active--
      }),
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(2) // 2 running, 3 queued
    gate.resolve()
    await Promise.all(tasks)
    expect(peak).toBe(2)
  })

  it('sheds load with TransformOverloadError once the wait queue is full', async () => {
    // Env override wins over the concurrency-derived default, so pin a tiny queue deterministically.
    const prev = process.env.IMAGES_TRANSFORM_MAX_QUEUE
    process.env.IMAGES_TRANSFORM_MAX_QUEUE = '2'
    setTransformConcurrency(1) // 1 active slot + 2 queue slots = 3 in flight before rejection
    try {
      const gate = defer()
      const running = withTransformLimit(() => gate.promise) // takes the single active slot
      const q1 = withTransformLimit(async () => {}) // queued (depth 1)
      const q2 = withTransformLimit(async () => {}) // queued (depth 2)
      // Fourth call: active full AND queue at capacity → rejected synchronously, not parked.
      await expect(withTransformLimit(async () => {})).rejects.toBeInstanceOf(TransformOverloadError)
      gate.resolve()
      await Promise.all([running, q1, q2])
    } finally {
      if (prev == null) delete process.env.IMAGES_TRANSFORM_MAX_QUEUE
      else process.env.IMAGES_TRANSFORM_MAX_QUEUE = prev
    }
  })
})

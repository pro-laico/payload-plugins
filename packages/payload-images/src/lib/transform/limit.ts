/**
 * FIFO concurrency gate for the CPU-bound Sharp transforms — a cold page fires every srcset
 * width at once, and an unbounded burst can exhaust a serverless function's memory/CPU.
 * Module-level singleton; default `cpus - 1` (min 1), overridable via
 * `IMAGES_TRANSFORM_CONCURRENCY` or the endpoint's `maxConcurrency`.
 *
 * The wait queue is BOUNDED: past `maxQueueDepth` pending transforms, new work is rejected with
 * {@link TransformOverloadError} (the endpoint maps it to 503 + Retry-After) rather than parked —
 * so a flood of cache-miss requests can't pile unbounded work behind the gate and starve the
 * process. Default depth `max(64, limit * 32)`, overridable via `IMAGES_TRANSFORM_MAX_QUEUE`.
 */
import os from 'node:os'

/** Thrown when the transform wait queue is full — a load-shedding signal, not a real failure. */
export class TransformOverloadError extends Error {
  constructor() {
    super('Image transform queue is full')
    this.name = 'TransformOverloadError'
  }
}

const posEnv = (name: string): number | undefined => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

let limit = posEnv('IMAGES_TRANSFORM_CONCURRENCY') ?? Math.max(1, (os.cpus?.().length ?? 4) - 1)
let maxQueueDepth = posEnv('IMAGES_TRANSFORM_MAX_QUEUE') ?? Math.max(64, limit * 32)
let active = 0
const queue: Array<() => void> = []

/** Override the max concurrent transforms (no-op for non-positive / non-finite values). Recomputes
 *  the queue-depth cap from the new limit, still letting an explicit env override win. */
export const setTransformConcurrency = (n?: number): void => {
  if (n != null && Number.isFinite(n) && n > 0) {
    limit = Math.floor(n)
    maxQueueDepth = posEnv('IMAGES_TRANSFORM_MAX_QUEUE') ?? Math.max(64, limit * 32)
  }
}

const pump = (): void => {
  if (active >= limit) return
  const run = queue.shift()
  if (!run) return
  active++
  run()
}

/** Run `fn` once a concurrency slot frees up; releases the slot when it settles. Throws
 *  {@link TransformOverloadError} immediately when the wait queue is already at capacity. */
export const withTransformLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (active >= limit && queue.length >= maxQueueDepth) throw new TransformOverloadError()
  await new Promise<void>((resolve) => {
    queue.push(resolve)
    pump()
  })
  try {
    return await fn()
  } finally {
    active--
    pump()
  }
}

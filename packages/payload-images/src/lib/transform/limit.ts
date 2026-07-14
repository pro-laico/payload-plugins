import os from 'node:os'

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

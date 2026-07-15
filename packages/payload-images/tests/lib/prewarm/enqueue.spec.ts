import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { enqueuePrewarmAfterChange } from '../../../src/hooks/collection/enqueuePrewarm'
import { enqueuePrewarmJob } from '../../../src/lib/prewarm/enqueue'
import { detectVariantIdentityChange } from '../../../src/hooks/collection/variantIdentity'

const fakeReq = (pending: { id?: string; input?: unknown }[] = []) => {
  const find = vi.fn().mockResolvedValue({ docs: pending })
  const queue = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockResolvedValue({})
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  const payload = { find, update, jobs: { queue }, logger } as unknown as Payload
  return { req: { payload }, find, queue, update, logger }
}

const doc = { id: 'img1', filename: 'a.jpg', mimeType: 'image/jpeg', focalX: 50, focalY: 50 }
const hook = enqueuePrewarmAfterChange({ taskSlug: 'imagesPrewarm', queue: 'default' })
const run = (args: Record<string, unknown>) => hook(args as never)

describe('detectVariantIdentityChange', () => {
  it('mirrors the purge trigger set: file, focal, hotspot — not metadata', () => {
    expect(detectVariantIdentityChange(doc, doc).any).toBe(false)
    expect(detectVariantIdentityChange(doc, { ...doc, alt: 'edited' }).any).toBe(false)
    expect(detectVariantIdentityChange(doc, { ...doc, filename: 'b.jpg' })).toMatchObject({ fileChanged: true, any: true })
    expect(detectVariantIdentityChange(doc, { ...doc, focalX: 80 })).toMatchObject({ focalChanged: true, any: true })
    expect(detectVariantIdentityChange(doc, { ...doc, cropLeft: 10 })).toMatchObject({ hotspotChanged: true, any: true })
  })

  it('catches same-filename byte replacement via filesize/dims (overwriteExistingFiles, admin crop)', () => {
    const withFile = { ...doc, filesize: 1000, width: 4000, height: 3000 }
    expect(detectVariantIdentityChange(withFile, withFile).any).toBe(false)
    expect(detectVariantIdentityChange(withFile, { ...withFile, filesize: 999 })).toMatchObject({ fileChanged: true, any: true })
    expect(detectVariantIdentityChange(withFile, { ...withFile, width: 3000, height: 2250, filesize: 999 })).toMatchObject({
      fileChanged: true,
      any: true,
    })
  })
})

describe('enqueuePrewarmAfterChange', () => {
  it('queues on create with reason create and a deferred waitUntil', async () => {
    const { req, queue } = fakeReq()
    await expect(run({ doc, operation: 'create', req })).resolves.toBe(doc)
    expect(queue).toHaveBeenCalledOnce()
    const args = queue.mock.calls[0]?.[0]
    expect(args).toMatchObject({ task: 'imagesPrewarm', queue: 'default', input: { sourceId: 'img1', reason: 'create' } })
    expect(args.waitUntil).toBeInstanceOf(Date)
  })

  it('skips metadata-only updates, queues replace/focal on identity changes', async () => {
    const { req, queue } = fakeReq()
    await run({ doc: { ...doc, alt: 'x' }, previousDoc: doc, operation: 'update', req })
    expect(queue).not.toHaveBeenCalled()
    await run({ doc: { ...doc, filename: 'b.jpg' }, previousDoc: doc, operation: 'update', req })
    expect(queue.mock.calls[0]?.[0]?.input?.reason).toBe('replace')
    await run({ doc: { ...doc, focalX: 80 }, previousDoc: doc, operation: 'update', req })
    expect(queue.mock.calls[1]?.[0]?.input?.reason).toBe('focal')
  })

  it('skips non-raster uploads and docs without a file', async () => {
    const { req, queue } = fakeReq()
    await run({ doc: { ...doc, mimeType: 'image/svg+xml' }, operation: 'create', req })
    await run({ doc: { id: 'x', filename: null }, operation: 'create', req })
    expect(queue).not.toHaveBeenCalled()
  })

  it('dedupes against a pending un-started job for the same source, re-deferring it past this save', async () => {
    const { req, queue, update } = fakeReq([{ id: 'job1', input: { sourceId: 'img1', reason: 'create' } }])
    await run({ doc, operation: 'create', req })
    expect(queue).not.toHaveBeenCalled()
    // The dupe's waitUntil is pushed forward so a runner pickup racing this save's open
    // transaction can't strand the new identity without a job.
    expect(update).toHaveBeenCalledOnce()
    expect(update.mock.calls[0]?.[0]).toMatchObject({ collection: 'payload-jobs', id: 'job1' })
    expect(typeof update.mock.calls[0]?.[0]?.data?.waitUntil).toBe('string')
  })

  it('still queues when the dupe re-defer fails (never strands the save)', async () => {
    const { req, queue, update } = fakeReq([{ id: 'job1', input: { sourceId: 'img1', reason: 'create' } }])
    update.mockRejectedValueOnce(new Error('update denied'))
    await run({ doc, operation: 'create', req })
    expect(queue).toHaveBeenCalledOnce()
  })

  it('swallows queue failures — the write is never blocked', async () => {
    const { req, queue, logger } = fakeReq()
    queue.mockRejectedValueOnce(new Error('no jobs runner'))
    await expect(run({ doc, operation: 'create', req })).resolves.toBe(doc)
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('enqueuePrewarmJob dedupe eligibility', () => {
  it('excludes permanently-failed (hasError) jobs from the pending-dedupe query', async () => {
    const { req, find } = fakeReq()
    await enqueuePrewarmJob(req.payload, { sourceId: 'img1', reason: 'create', taskSlug: 'imagesPrewarm', queue: 'default' })
    const where = find.mock.calls[0]?.[0]?.where
    // Without the hasError clause a dead retries-exhausted job (completedAt null, processing false)
    // would dedupe every future enqueue forever — the runner never picks it up again.
    expect(where.and).toContainEqual({ hasError: { not_equals: true } })
    expect(where.and).toContainEqual({ completedAt: { exists: false } })
    expect(where.and).toContainEqual({ processing: { not_equals: true } })
  })

  it('still enqueues when the only matching job is a failed one (the query filters it out)', async () => {
    // The failed job is NOT returned by the runnable-jobs query, so find yields no dupe → enqueue.
    const { req, queue } = fakeReq([])
    await enqueuePrewarmJob(req.payload, { sourceId: 'img1', reason: 'replace', taskSlug: 'imagesPrewarm', queue: 'default' })
    expect(queue).toHaveBeenCalledOnce()
  })
})

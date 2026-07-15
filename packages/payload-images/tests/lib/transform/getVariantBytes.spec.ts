import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { getOrCreateVariantBytes } from '../../../src/lib/transform/getVariantBytes'

// Isolate the persist behavior: bytes come from stubs, `after()` throws like any non-request context.
vi.mock('next/server', () => ({
  after: () => {
    throw new Error('no request scope')
  },
}))
vi.mock('../../../src/lib/transform/source', () => ({ readBytes: vi.fn().mockResolvedValue(Buffer.from('original')) }))
vi.mock('../../../src/lib/transform/sharp', () => ({
  transformImage: vi.fn().mockResolvedValue({ data: Buffer.from('variant'), mimeType: 'image/webp' }),
}))
vi.mock('../../../src/lib/transform/staticDir', () => ({ resolveStaticDir: () => undefined }))

const fakePayload = () => {
  let createResolved = false
  const find = vi.fn().mockResolvedValue({ docs: [] }) // always a cache miss
  const create = vi.fn().mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 5))
    createResolved = true
    return {}
  })
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  const payload = { find, create, logger } as unknown as Payload
  return { payload, create, wasPersisted: () => createResolved }
}

const args = (payload: Payload, deferPersist?: boolean | 'never') => ({
  payload,
  source: { id: 'img1', filename: 'a.jpg' },
  params: { w: 640, h: 360, fit: 'cover' as const, q: 75, fmt: 'auto' as const },
  format: 'webp' as const,
  sourceSlug: 'images',
  variantSlug: 'generated-images',
  base: '',
  maxInputPixels: 100_000_000,
  ...(deferPersist === undefined ? {} : { deferPersist }),
})

describe('getOrCreateVariantBytes persist modes', () => {
  it('deferPersist: false awaits the variant row write before resolving (job/CLI contexts)', async () => {
    const { payload, create, wasPersisted } = fakePayload()
    const res = await getOrCreateVariantBytes(args(payload, false))
    expect(res.ok).toBe(true)
    expect(create).toHaveBeenCalledOnce()
    expect(wasPersisted()).toBe(true) // resolved, not just started
  })

  it('default mode fires the persist without blocking the bytes (after() fallback path)', async () => {
    const { payload, create, wasPersisted } = fakePayload()
    const res = await getOrCreateVariantBytes(args(payload))
    expect(res.ok).toBe(true)
    expect(create).toHaveBeenCalledOnce() // started…
    expect(wasPersisted()).toBe(false) // …but the bytes did not wait for it
    await new Promise((r) => setTimeout(r, 15))
    expect(wasPersisted()).toBe(true)
  })

  it('persists the render path (windowed) and normalizes png quality to null', async () => {
    const { payload, create } = fakePayload()
    const res = await getOrCreateVariantBytes({ ...args(payload, false), format: 'png' as const })
    expect(res.ok).toBe(true)
    const data = create.mock.calls[0]?.[0]?.data
    expect(data.windowed).toBe(true) // w+h cover → hotspot-windowed render
    expect(data.quality).toBeNull() // png ignores quality in encoder + cache key alike
  })

  it("deferPersist: 'never' serves the bytes but never persists (the at-cap path)", async () => {
    const { payload, create } = fakePayload()
    const res = await getOrCreateVariantBytes(args(payload, 'never'))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.toString()).toBe('variant')
    await new Promise((r) => setTimeout(r, 15))
    expect(create).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { createImageFor } from '../../src/lib/imageFor'
import { RESPONSIVE_IMAGE_SELECT } from '../../src/lib/renderIntent'

const doc = { id: '1', alt: 'a lighthouse', src: '/api/img/1?w=1280', srcset: '/api/img/1?w=640 640w', placeholder: 'data:image/png;base64,x' }

type FindArgs = { id: string | number; collection: string; context: Record<string, unknown> } & Record<string, unknown>

const fakePayload = (sourceSlug?: string) => {
  const findByID = vi.fn<(args: FindArgs) => Promise<typeof doc | null>>().mockResolvedValue(doc)
  const payload = { config: { custom: { payloadImages: sourceSlug ? { sourceSlug } : {} } }, findByID } as unknown as Payload
  return { payload, findByID }
}

describe('createImageFor', () => {
  it('runs the read contract in one call: RESPONSIVE_IMAGE_SELECT, depth 0, disableErrors, chained context', async () => {
    const { payload, findByID } = fakePayload()
    const imageFor = createImageFor(payload)
    await expect(imageFor('1').aspectRatio('16:9').quality(60).fit('contain').format('webp').blur('md').fetch()).resolves.toBe(doc)
    expect(findByID).toHaveBeenCalledExactlyOnceWith({
      id: '1',
      collection: 'images',
      depth: 0,
      select: RESPONSIVE_IMAGE_SELECT,
      disableErrors: true,
      context: { image: { aspectRatio: '16:9', quality: 60, fit: 'contain', format: 'webp' }, blur: { quality: 'md' } },
    })
  })

  it('accepts the getPayload promise as-is — only the terminal awaits it', async () => {
    const { payload, findByID } = fakePayload()
    const imageFor = createImageFor(Promise.resolve(payload))
    await expect(imageFor(7).fetch()).resolves.toBe(doc)
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 7, context: {} }))
  })

  it('reads the source collection off the plugin marker (extendCollection setups)', async () => {
    const { payload, findByID } = fakePayload('media')
    await createImageFor(payload)('1').fetch()
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
  })

  it('takes a populated doc as the source and fetches by its id', async () => {
    const { payload, findByID } = fakePayload()
    await createImageFor(payload)({ id: 42 }).fetch()
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
  })

  it('null in, null out — an empty source never hits the API; a missing doc resolves null', async () => {
    const { payload, findByID } = fakePayload()
    const imageFor = createImageFor(payload)
    await expect(imageFor(null).fetch()).resolves.toBeNull()
    await expect(imageFor(undefined).fetch()).resolves.toBeNull()
    await expect(imageFor('').fetch()).resolves.toBeNull()
    expect(findByID).not.toHaveBeenCalled()
    findByID.mockResolvedValueOnce(null)
    await expect(imageFor('missing').fetch()).resolves.toBeNull()
  })

  it('seeds a whole declared render as the second arg — the ImageGetter shape — and chains on top', async () => {
    const { payload, findByID } = fakePayload()
    await createImageFor(payload)('1', { image: { aspectRatio: '4:3' }, blur: { quality: 'md' } })
      .quality(50)
      .fetch()
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ context: { image: { aspectRatio: '4:3', quality: 50 }, blur: { quality: 'md' } } }),
    )
  })

  it('chains immutably — a shared base branches without aliasing', async () => {
    const { payload, findByID } = fakePayload()
    const base = createImageFor(payload)('1').aspectRatio('1:1')
    await base.quality(40).fetch()
    await base.blur('xl').fetch()
    await base.fetch()
    const contexts = findByID.mock.calls.map(([args]) => args.context)
    expect(contexts).toEqual([
      { image: { aspectRatio: '1:1', quality: 40 } },
      { image: { aspectRatio: '1:1' }, blur: { quality: 'xl' } },
      { image: { aspectRatio: '1:1' } },
    ])
  })
})

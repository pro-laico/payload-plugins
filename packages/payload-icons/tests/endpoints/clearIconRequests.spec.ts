import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { EndpointAccess } from '../../src/_kit'
import { createClearIconRequestsEndpoint } from '../../src/endpoints/clearIconRequests'

const handlerOf = (slug: string, access?: EndpointAccess) => {
  const endpoint = createClearIconRequestsEndpoint(slug, access)
  if (typeof endpoint.handler !== 'function') throw new Error('expected a handler')
  return endpoint.handler
}

const reqWith = (
  slug: string,
  del = vi.fn().mockResolvedValue({ docs: [{ id: 1 }, { id: 2 }] }),
): { req: PayloadRequest; del: typeof del } => ({
  req: { user: { id: 1 }, payload: { collections: { [slug]: {} }, delete: del } } as unknown as PayloadRequest,
  del,
})

describe('createClearIconRequestsEndpoint', () => {
  it('deletes from the slug it was handed, not the default', async () => {
    const { req, del } = reqWith('glyphRequest')
    const res = await handlerOf('glyphRequest')(req)
    expect(del).toHaveBeenCalledWith(expect.objectContaining({ collection: 'glyphRequest' }))
    await expect(res.json()).resolves.toEqual({ success: true, message: 'Cleared 2 runtime requests.' })
  })

  it('reports tracking off when that slug is not a registered collection', async () => {
    const { req, del } = reqWith('somethingElse')
    const res = await handlerOf('glyphRequest')(req)
    expect(del).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ success: false, message: 'Request tracking is not enabled.' })
  })

  it('401s an anonymous caller', async () => {
    const res = await handlerOf('iconRequest')({ payload: {} } as unknown as PayloadRequest)
    expect(res.status).toBe(401)
  })

  it('honours a custom gate that denies a logged-in caller', async () => {
    const { req, del } = reqWith('iconRequest')
    const res = await handlerOf('iconRequest', () => false)(req)
    expect(res.status).toBe(401)
    expect(del).not.toHaveBeenCalled()
  })
})

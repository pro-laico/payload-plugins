import { describe, expect, it, vi } from 'vitest'

import { muxRefreshHandler } from '../../src/endpoints/refresh'

const PLAYBACK = [{ id: 'pb_1', policy: 'public' }]

const harness = ({ doc, asset }: { doc?: Record<string, unknown>; asset?: Record<string, unknown> }) => {
  const update = vi.fn(async () => ({}))
  const retrieve = vi.fn(async () => {
    if (!asset) throw new Error('no asset')
    return asset
  })
  const req = {
    query: { id: '1' },
    // The endpoint defaults to any logged-in user; the 403 path is covered by hitting it live.
    user: { id: 'u1' },
    payload: {
      findByID: async () => {
        if (!doc) throw new Error('not found')
        return doc
      },
      update,
      logger: { error: vi.fn() },
    },
  }
  const options = { options: { access: { refresh: undefined } } }
  const handler = muxRefreshHandler({ video: { assets: { retrieve } } } as never, options as never, 'mux-video')
  return { handler, req, update, retrieve }
}

const call = async (h: ReturnType<typeof harness>) => {
  const res = await h.handler(h.req as never)
  return { status: res.status, body: await res.json() }
}

describe('muxRefreshHandler', () => {
  it('promotes a stale preparing doc once Mux reports ready', async () => {
    // The whole point: no webhook ever arrives in local development, so the document needs a way
    // to ask directly rather than sit on `preparing` forever.
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'preparing' }, asset: { status: 'ready', playback_ids: PLAYBACK, duration: 3 } })
    expect(await call(h)).toMatchObject({ status: 200, body: { status: 'ready', changed: true } })
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready', duration: 3 }) }))
  })

  it('writes nothing while the asset is still encoding, so polling it stays cheap', async () => {
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'preparing' }, asset: { status: 'preparing', playback_ids: PLAYBACK } })
    expect(await call(h)).toMatchObject({ status: 200, body: { status: 'preparing', changed: false } })
    expect(h.update).not.toHaveBeenCalled()
  })

  it('records an errored asset', async () => {
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'preparing' }, asset: { status: 'errored', errors: { messages: ['bad input'] } } })
    expect(await call(h)).toMatchObject({ status: 200, body: { status: 'errored', changed: true } })
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'errored', error: 'bad input' }) }))
  })

  it('short-circuits a settled doc without calling Mux', async () => {
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'ready' } })
    expect(await call(h)).toMatchObject({ status: 200, body: { status: 'ready', changed: false } })
    expect(h.retrieve).not.toHaveBeenCalled()
  })

  it('refuses a ready-looking asset that has nothing to play', async () => {
    // A policy-less asset would otherwise be marked ready with no playback id behind it.
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'preparing' }, asset: { status: 'ready', playback_ids: [] } })
    expect(await call(h)).toMatchObject({ body: { status: 'preparing', changed: false } })
    expect(h.update).not.toHaveBeenCalled()
  })

  it('reports a Mux outage as a gateway failure rather than corrupting the doc', async () => {
    const h = harness({ doc: { id: 1, assetId: 'a1', status: 'preparing' } })
    expect((await call(h)).status).toBe(502)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('rejects a document with no Mux asset, and a missing one', async () => {
    expect((await call(harness({ doc: { id: 1, status: 'preparing' } }))).status).toBe(400)
    expect((await call(harness({}))).status).toBe(404)
  })
})

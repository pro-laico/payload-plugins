import { describe, expect, it, vi } from 'vitest'

import { getBeforeChangeHook } from '../../src/hooks/collection/beforeChange'

const PLAYBACK = [{ id: 'pb_1', policy: 'public' }]

const muxWith = (asset: Record<string, unknown>) => ({
  video: { assets: { retrieve: vi.fn(async () => asset), delete: vi.fn(async () => undefined) } },
})

const run = (mux: unknown, data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
  getBeforeChangeHook(mux as never)({
    data,
    originalDoc,
    operation: originalDoc ? 'update' : 'create',
    collection: { slug: 'mux-video' },
    req: { payload: { count: async () => ({ totalDocs: 0 }), logger: { error: vi.fn() } } },
  } as never)

describe('getBeforeChangeHook — a still-encoding asset', () => {
  it('keeps the playback ids Mux already assigned instead of discarding them', async () => {
    // Mux attaches playback ids when it creates the asset, seconds before encoding finishes.
    // Dropping them here is what left docs with nothing to play and made the ready webhook the
    // only thing that could ever supply one.
    const mux = muxWith({ status: 'preparing', playback_ids: PLAYBACK })
    const out = await run(mux, { assetId: 'a1', title: 'Clip' })
    expect(out.playbackOptions).toEqual([{ playbackId: 'pb_1', playbackPolicy: 'public' }])
    expect(out.status).toBe('preparing')
  }, 15_000)

  it('does not blank fields the asset cannot know yet', async () => {
    // duration/aspectRatio/tracks arrive with encoding; writing them as undefined would clear
    // whatever the webhook later filled in.
    const mux = muxWith({ status: 'preparing', playback_ids: PLAYBACK })
    const out = await run(mux, { assetId: 'a1', title: 'Clip' })
    expect('duration' in out).toBe(false)
    expect('aspectRatio' in out).toBe(false)
  }, 15_000)

  it('reports ready only once Mux says so', async () => {
    const mux = muxWith({ status: 'ready', playback_ids: PLAYBACK, duration: 32.4, aspect_ratio: '16:9' })
    const out = await run(mux, { assetId: 'a1', title: 'Clip' })
    expect(out).toMatchObject({ status: 'ready', duration: 32.4, aspectRatio: '16/9' })
  })
})

describe('getBeforeChangeHook — re-saving an unsettled doc', () => {
  const saved = { id: 1, assetId: 'a1' }

  it('heals a doc whose ready webhook never arrived', async () => {
    const mux = muxWith({ status: 'ready', playback_ids: PLAYBACK, duration: 32.4 })
    const out = await run(mux, { assetId: 'a1', status: 'preparing', playbackOptions: [] }, saved)
    expect(out).toMatchObject({ status: 'ready', duration: 32.4 })
    expect(mux.video.assets.retrieve).toHaveBeenCalledOnce()
  })

  it('still re-checks a doc that has playback ids but is stuck on preparing', async () => {
    // The old early-return treated "has playback options" as settled, so a doc with a stale
    // preparing status could never recover — the case this whole fix is about.
    const mux = muxWith({ status: 'ready', playback_ids: PLAYBACK })
    const out = await run(mux, { assetId: 'a1', status: 'preparing', playbackOptions: [{ playbackId: 'pb_1' }] }, saved)
    expect(mux.video.assets.retrieve).toHaveBeenCalledOnce()
    expect(out.status).toBe('ready')
  })

  it('leaves a settled doc alone rather than calling Mux on every save', async () => {
    const mux = muxWith({ status: 'ready', playback_ids: PLAYBACK })
    await run(mux, { assetId: 'a1', status: 'ready', playbackOptions: [{ playbackId: 'pb_1' }] }, saved)
    expect(mux.video.assets.retrieve).not.toHaveBeenCalled()
  })

  it('records an errored asset without deleting the document', async () => {
    const mux = muxWith({ status: 'errored', errors: { messages: ['bad input'] } })
    const out = await run(mux, { assetId: 'a1', status: 'preparing', playbackOptions: [] }, saved)
    expect(out).toMatchObject({ status: 'errored', error: 'bad input' })
  })
})

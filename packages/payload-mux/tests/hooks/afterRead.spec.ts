import { describe, expect, it, vi } from 'vitest'

import { signableUrlAfterRead } from '../../src/hooks/field/afterRead'

type UrlType = 'video' | 'thumbnail' | 'gif'

const buildUrl = (id: string) => new URL(`https://image.mux.com/${id}/thumbnail.png`)

const read = async (type: UrlType, data: Record<string, unknown>, policy = 'public', signPlaybackId = vi.fn()) => {
  const hook = signableUrlAfterRead({ jwt: { signPlaybackId } } as never, { options: {} } as never, type, buildUrl)
  const url = await hook({ data, siblingData: { playbackId: 'abc', playbackPolicy: policy } } as never)
  return { url: typeof url === 'string' ? new URL(url) : null, signPlaybackId }
}

describe('signableUrlAfterRead — poster timestamp', () => {
  it('pins an unset poster to the first frame rather than letting Mux pick the middle', async () => {
    // Mux's thumbnail endpoint defaults to the midpoint when `time` is absent, which makes the
    // poster arbitrary; blank should mean frame zero.
    const { url } = await read('thumbnail', {})
    expect(url?.searchParams.get('time')).toBe('0')
  })

  it('honors an explicit poster timestamp', async () => {
    const { url } = await read('thumbnail', { posterTimestamp: 12.5 })
    expect(url?.searchParams.get('time')).toBe('12.5')
  })

  it('leaves the playback URL free of a time param', async () => {
    const { url } = await read('video', { posterTimestamp: 12.5 })
    expect(url?.searchParams.has('time')).toBe(false)
  })

  it('passes a set timestamp through to the gif but adds no default', async () => {
    // The animated endpoint takes start/end, not time — so don't invent one it never asked for.
    expect((await read('gif', { posterTimestamp: 3 })).url?.searchParams.get('time')).toBe('3')
    expect((await read('gif', {})).url?.searchParams.has('time')).toBe(false)
  })

  it('signs the same time it puts in the URL, including the zero default', async () => {
    // A signed URL's token params must match its query params or Mux rejects the request.
    const signPlaybackId = vi.fn(async () => 'tok')
    const { url } = await read('thumbnail', {}, 'signed', signPlaybackId)
    expect(signPlaybackId).toHaveBeenCalledWith('abc', expect.objectContaining({ params: { time: '0' } }))
    expect(url?.searchParams.get('time')).toBe('0')
    expect(url?.searchParams.get('token')).toBe('tok')
  })
})

import type Mux from '@mux/mux-node'
import type { FieldHook } from 'payload'

import type { ResolvedMuxVideoOptions } from '../../types'

const signIfNeeded = async (
  mux: Mux,
  options: ResolvedMuxVideoOptions,
  url: URL,
  playbackId: string,
  policy: unknown,
  type: 'video' | 'thumbnail' | 'gif',
  posterTimestamp?: number,
): Promise<void> => {
  if (policy !== 'signed') return
  const params = typeof posterTimestamp === 'number' ? { time: posterTimestamp.toString() } : undefined
  const token = await mux.jwt.signPlaybackId(playbackId, { expiration: options.options.signedUrlOptions?.expiration ?? '1d', type, params })
  url.searchParams.set('token', token)
}

export const signableUrlAfterRead =
  (mux: Mux, options: ResolvedMuxVideoOptions, type: 'video' | 'thumbnail' | 'gif', buildUrl: (playbackId: string) => URL): FieldHook =>
  async ({ data, siblingData }) => {
    const playbackId = siblingData?.playbackId
    if (!playbackId) return null
    const stored = typeof data?.posterTimestamp === 'number' ? data.posterTimestamp : undefined
    // Mux picks the middle of the video when `time` is absent. The first frame is both the
    // predictable poster and what leaving the field blank is taken to mean, so pin thumbnails to 0.
    const posterTimestamp = type === 'thumbnail' ? (stored ?? 0) : type === 'gif' ? stored : undefined
    const url = buildUrl(playbackId)
    if (posterTimestamp !== undefined) url.searchParams.set('time', posterTimestamp.toString())
    await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, type, posterTimestamp)
    return url.toString()
  }

import type Mux from '@mux/mux-node'
import type { FieldHook } from 'payload'
import type { MuxVideoPluginOptions } from '../../types'

/** Sign a playback id for a given media `type` when the policy is `signed`, and append the
 *  token to `url`. A no-op for public playback. */
const signIfNeeded = async (
  mux: Mux,
  options: MuxVideoPluginOptions,
  url: URL,
  playbackId: string,
  policy: unknown,
  type: 'video' | 'thumbnail' | 'gif',
  posterTimestamp?: number,
): Promise<void> => {
  if (policy !== 'signed') return
  const params = typeof posterTimestamp === 'number' ? { time: posterTimestamp.toString() } : undefined
  const token = await mux.jwt.signPlaybackId(playbackId, { expiration: options.signedUrlOptions?.expiration ?? '1d', type, params })
  url.searchParams.set('token', token)
}

/** The afterRead behind a signable virtual URL field (`playbackUrl` / `posterUrl` / `gifUrl`). On
 *  read it builds the Mux URL from the sibling `playbackId`, stamps the poster `time` for
 *  thumbnail/gif, and signs it when the policy is `signed`. Returns null until a playback id exists. */
export const signableUrlAfterRead =
  (mux: Mux, options: MuxVideoPluginOptions, type: 'video' | 'thumbnail' | 'gif', buildUrl: (playbackId: string) => URL): FieldHook =>
  async ({ data, siblingData }) => {
    const playbackId = siblingData?.playbackId
    if (!playbackId) return null
    const posterTimestamp = type !== 'video' && typeof data?.posterTimestamp === 'number' ? data.posterTimestamp : undefined
    const url = buildUrl(playbackId)
    if (posterTimestamp !== undefined) url.searchParams.set('time', posterTimestamp.toString())
    await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, type, posterTimestamp)
    return url.toString()
  }

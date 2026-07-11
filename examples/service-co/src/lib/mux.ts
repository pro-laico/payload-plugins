import type { MuxPlayback, MuxVideoDoc } from '@/types'

/** The first playable Mux playback row (has a playback id), or undefined. */
export const firstPlayback = (video: MuxVideoDoc | null | undefined): MuxPlayback | undefined =>
  video?.playbackOptions?.find((p) => p.playbackId) ?? undefined

import type { RelId } from './primitives'

/** One Mux playback row — the virtual URLs are computed on read from the stored playback id. */
export type MuxPlayback = { playbackId?: string | null; playbackUrl?: string | null; posterUrl?: string | null; gifUrl?: string | null }
export type MuxVideoDoc = { id: RelId; title?: string | null; playbackOptions?: MuxPlayback[] | null }

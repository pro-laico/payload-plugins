import type { MuxSource } from './source'

/** The transient `source` a caller sets to ingest server-side: a string path/URL, or an
 *  object carrying the path/URL plus per-video options. Never persisted. */
export interface MuxSourceInput {
  file?: string
  url?: string
  playbackPolicy?: 'public' | 'signed'
  posterTimestamp?: number
  corsOrigin?: string
}

export interface NormalizedSource {
  ref: MuxSource
  playbackPolicy?: 'public' | 'signed'
  corsOrigin?: string
  posterTimestamp?: number
}

import type { MuxSource } from './source'

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

import type { MuxSource } from './source'
import type { MuxVideoNewAssetSettings } from '../settings/uploadSettings'

export interface IngestMuxAssetOptions {
  newAssetSettings?: MuxVideoNewAssetSettings
  playbackPolicy?: 'public' | 'signed'
  corsOrigin?: string
}

export interface IngestMuxVideoOptions {
  source: MuxSource
  title: string
  playbackPolicy?: 'public' | 'signed'
  posterTimestamp?: number
  collection?: string
}

export { default, muxVideoPlugin } from './plugin'

// The typed view of `config.custom.payloadMux`.
export { readMuxMarker } from './lib/marker'
export type { PayloadMuxMarker } from './types'

export { ingestMuxVideo } from './lib/ingest'
export type { IngestMuxVideoOptions } from './types'

export type {
  MuxAdminThumbnail,
  MuxAnimatedGifExtension,
  MuxPlaybackPolicy,
  MuxPosterExtension,
  MuxVideoInitSettings,
  MuxVideoNewAssetSettings,
  MuxVideoPluginOptions,
  MuxVideoSignedUrlOptions,
  MuxVideoUploadSettings,
} from './types'

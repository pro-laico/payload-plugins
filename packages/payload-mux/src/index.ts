export { default, muxPlugin, muxVideoPlugin } from './plugin'

// The typed view of `config.custom.payloadMux`.
export { readMuxMarker } from './lib/marker'
export type { PayloadMuxMarker } from './types'

export { ingestMuxVideo } from './lib/ingest'
export type { IngestMuxVideoOptions } from './types'

export type { EndpointAccess } from './_kit'
export type {
  MuxAccessOptions,
  MuxAdminThumbnail,
  MuxAnimatedGifExtension,
  MuxOptions,
  MuxPlaybackPolicy,
  MuxPosterExtension,
  MuxVideoCollectionOptions,
  MuxVideoInitSettings,
  MuxVideoNewAssetSettings,
  MuxVideoPluginOptions,
  MuxVideoSignedUrlOptions,
  MuxVideoUploadSettings,
} from './types'

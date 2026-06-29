// The plugin
export { muxVideoPlugin } from './plugin'

// The collection factory, for advanced consumers assembling their own config
export { MuxVideo } from './collections/MuxVideo'

// Server-side ingest — create a mux-video from a local file / URL (seeding, imports, migrations)
export { ingestMuxVideo } from './lib/ingest'
export type { IngestMuxVideoOptions } from './lib/ingest'

// Seed integration — register mux-video as a @pro-laico/payload-seed asset provider
export { muxAssetProvider } from './seed'
export type { MuxAssetProviderOptions } from './seed'

// Types
export type {
  MuxVideoInitSettings,
  MuxVideoNewAssetSettings,
  MuxVideoPluginOptions,
  MuxVideoSignedUrlOptions,
  MuxVideoUploadSettings,
} from './types'

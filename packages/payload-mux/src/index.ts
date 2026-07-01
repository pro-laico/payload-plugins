// The plugin
export { muxVideoPlugin } from './plugin'

// The collection factory, for advanced consumers assembling their own config
export { MuxVideo } from './collections/MuxVideo'

// Server-side ingest — create a mux-video from a local file / URL (seeding, imports, migrations)
export { ingestMuxVideo } from './lib/ingest'
export type { IngestMuxVideoOptions } from './lib/ingest'

// Types
export type {
  MuxVideoInitSettings,
  MuxVideoNewAssetSettings,
  MuxVideoPluginOptions,
  MuxVideoSignedUrlOptions,
  MuxVideoUploadSettings,
} from './types'

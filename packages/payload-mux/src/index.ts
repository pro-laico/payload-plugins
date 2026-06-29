// The plugin
export { muxVideoPlugin } from './plugin'

// The collection factory, for advanced consumers assembling their own config
export { MuxVideo } from './collections/MuxVideo'

// Types
export type {
  MuxVideoInitSettings,
  MuxVideoNewAssetSettings,
  MuxVideoPluginOptions,
  MuxVideoSignedUrlOptions,
  MuxVideoUploadSettings,
} from './types'

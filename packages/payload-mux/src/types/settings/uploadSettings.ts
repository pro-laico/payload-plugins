import type Mux from '@mux/mux-node'

type AssetOptions = Mux.Video.Assets.AssetOptions

export type MuxVideoNewAssetSettings = AssetOptions & {
  playback_policy?: Array<'public' | 'signed'>
}

export interface MuxVideoUploadSettings {
  /** CORS origin for the direct-upload URL — usually your site. Default: `NEXT_PUBLIC_SERVER_URL`, else `'*'`. */
  cors_origin?: string
  /** Extra `new_asset_settings` forwarded to Mux. An explicit `playback_policy` here beats the top-level `playbackPolicy`. */
  new_asset_settings?: MuxVideoNewAssetSettings
}

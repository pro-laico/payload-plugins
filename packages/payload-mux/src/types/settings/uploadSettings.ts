import type Mux from '@mux/mux-node'

type AssetOptions = Mux.Video.Assets.AssetOptions

export type MuxVideoNewAssetSettings = AssetOptions & {
  playback_policy?: Array<'public' | 'signed'>
}

export interface MuxVideoUploadSettings {
  cors_origin?: string
  new_asset_settings?: MuxVideoNewAssetSettings
}

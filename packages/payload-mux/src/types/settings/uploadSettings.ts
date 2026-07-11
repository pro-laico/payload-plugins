import type Mux from '@mux/mux-node'

/** Mux's asset-creation params, via the SDK namespace (avoids a deep subpath import). */
type AssetOptions = Mux.Video.Assets.AssetOptions

/** `new_asset_settings` passed to Mux when creating an asset, plus the playback policy. */
export type MuxVideoNewAssetSettings = AssetOptions & {
  /** Playback policy for uploaded videos. `['public']` by default; use `['signed']` for
   *  the signed-URL setup. */
  playback_policy?: Array<'public' | 'signed'>
}

/** Settings applied to every upload. */
export interface MuxVideoUploadSettings {
  /** CORS origin for the direct-upload URL (usually your site URL).
   *  @default process.env.NEXT_PUBLIC_SERVER_URL, falling back to '*' */
  cors_origin?: string
  /** Extra settings forwarded to Mux when the asset is created. */
  new_asset_settings?: MuxVideoNewAssetSettings
}

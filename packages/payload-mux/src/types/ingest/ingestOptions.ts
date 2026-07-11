import type { MuxSource } from './source'
import type { MuxVideoNewAssetSettings } from '../settings/uploadSettings'

export interface IngestMuxAssetOptions {
  /** Base new-asset settings — normally the plugin's `uploadSettings.new_asset_settings`, so a
   *  server-side ingest produces the same asset config as the admin direct-upload path. */
  newAssetSettings?: MuxVideoNewAssetSettings
  /** Playback policy override for this asset. When set, wins over `newAssetSettings`'s policy;
   *  otherwise the configured policy applies (falling back to `'public'`). */
  playbackPolicy?: 'public' | 'signed'
  /** CORS origin for the direct upload. @default '*' */
  corsOrigin?: string
}

export interface IngestMuxVideoOptions {
  /** Local file path or `http(s)` URL of the video to ingest. */
  source: MuxSource
  /** Title for the created `mux-video` doc (must be unique within the collection). */
  title: string
  /** Playback policy override for the uploaded asset. @default the plugin's configured policy */
  playbackPolicy?: 'public' | 'signed'
  /** Optional poster timestamp (seconds). */
  posterTimestamp?: number
  /** The `mux-video` collection slug. @default 'mux-video' */
  collection?: string
}

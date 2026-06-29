import type { AssetOptions } from '@mux/mux-node/resources/video/assets.mjs'
import type { PayloadRequest, TypedCollection } from 'payload'

/** Mux API credentials + webhook/signing secrets. Pull these from the Mux dashboard. */
export interface MuxVideoInitSettings {
  /** The Mux token ID. */
  tokenId: string
  /** The Mux token secret. */
  tokenSecret: string
  /** The secret used to verify incoming Mux webhooks. */
  webhookSecret: string
  /** JWT signing key ID. Only required for the signed-playback setup. */
  jwtSigningKey?: string
  /** JWT private key. Only required for the signed-playback setup. */
  jwtPrivateKey?: string
}

/** `new_asset_settings` passed to Mux when creating an asset, plus the playback policy. */
export type MuxVideoNewAssetSettings = AssetOptions & {
  /** Playback policy for uploaded videos. `['public']` by default; use `['signed']` for
   *  the signed-URL setup. */
  playback_policy?: Array<'public' | 'signed'>
}

/** Settings applied to every upload. */
export interface MuxVideoUploadSettings {
  /** Required CORS origin for the direct-upload URL (usually your site URL). */
  cors_origin: string
  /** Extra settings forwarded to Mux when the asset is created. */
  new_asset_settings?: MuxVideoNewAssetSettings
}

/** Signed-URL generation options. */
export interface MuxVideoSignedUrlOptions {
  /** Expiration window for signed playback/poster/gif URLs. @default "1d" */
  expiration?: string
}

/** Configuration for the Mux Video plugin. */
export interface MuxVideoPluginOptions {
  /** Set to `false` to disable the plugin (collection, endpoints, and hooks are skipped). */
  enabled: boolean
  /** Mux credentials + webhook secret. */
  initSettings: MuxVideoInitSettings
  /** Upload settings (CORS origin + new-asset settings). */
  uploadSettings: MuxVideoUploadSettings
  /** Slug of an existing collection to extend with Mux fields instead of creating the
   *  default `mux-video` collection. */
  extendCollection?: keyof TypedCollection
  /** Gate who may request an upload / read videos. Defaults to logged-in admins. */
  access?: (request: PayloadRequest) => Promise<boolean> | boolean
  /** Signed-URL generation options. */
  signedUrlOptions?: MuxVideoSignedUrlOptions
  /** Image format for video posters. @default "png" */
  posterExtension?: 'webp' | 'jpg' | 'png'
  /** Image format for animated preview thumbnails. @default "gif" */
  animatedGifExtension?: 'gif' | 'webp'
  /** Thumbnail shown in the collection list view: animated `gif`, static `image`, or
   *  `none`. @default "gif" */
  adminThumbnail?: 'gif' | 'image' | 'none'
  /** When set, the webhook creates a Payload doc for a Mux asset that doesn't exist yet
   *  (on `video.asset.created` / `ready` / `updated`) — backfills videos uploaded directly
   *  in Mux. @default false */
  autoCreateOnWebhook?: boolean
}

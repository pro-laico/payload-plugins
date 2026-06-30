import type Mux from '@mux/mux-node'
import type { PayloadRequest, TypedCollection } from 'payload'

/** Mux's asset-creation params, via the SDK namespace (avoids a deep subpath import). */
type AssetOptions = Mux.Video.Assets.AssetOptions

/**
 * Mux API credentials + webhook/signing secrets. Every field is optional: anything you don't
 * pass is read from the standard Mux environment variables by the SDK —
 * `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY`,
 * `MUX_PRIVATE_KEY`. Only pass a field to override it (e.g. a non-standard env var name).
 */
export interface MuxVideoInitSettings {
  /** The Mux token ID. @default process.env.MUX_TOKEN_ID */
  tokenId?: string
  /** The Mux token secret. @default process.env.MUX_TOKEN_SECRET */
  tokenSecret?: string
  /** The secret used to verify incoming Mux webhooks. @default process.env.MUX_WEBHOOK_SECRET */
  webhookSecret?: string
  /** JWT signing key ID (signed playback). @default process.env.MUX_SIGNING_KEY */
  jwtSigningKey?: string
  /** JWT private key (signed playback). @default process.env.MUX_PRIVATE_KEY */
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
  /** CORS origin for the direct-upload URL (usually your site URL).
   *  @default process.env.NEXT_PUBLIC_SERVER_URL, falling back to '*' */
  cors_origin?: string
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
  /** Set to `false` to disable the plugin (collection, endpoints, and hooks are skipped).
   *  @default true */
  enabled?: boolean
  /** Mux credentials + webhook secret. Optional — fields default to the standard `MUX_*`
   *  environment variables, so you only pass this to override an env var. */
  initSettings?: MuxVideoInitSettings
  /** Upload settings (CORS origin + new-asset settings). Optional — `cors_origin` defaults
   *  to `NEXT_PUBLIC_SERVER_URL`. */
  uploadSettings?: MuxVideoUploadSettings
  /** Playback policy for newly uploaded videos: `'public'` URLs, or `'signed'` JWT-signed
   *  URLs (also set `MUX_SIGNING_KEY` + `MUX_PRIVATE_KEY`). Shorthand for
   *  `uploadSettings.new_asset_settings.playback_policy`; an explicit value there wins.
   *  @default 'public' */
  playbackPolicy?: 'public' | 'signed'
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

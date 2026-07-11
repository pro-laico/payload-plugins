import type { PayloadRequest, TypedCollection } from 'payload'
import type { MuxVideoInitSettings } from '../settings/initSettings'
import type { MuxVideoSignedUrlOptions } from '../settings/signedUrlOptions'
import type { MuxVideoUploadSettings } from '../settings/uploadSettings'

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

import type { CollectionConfig, PayloadRequest } from 'payload'

import type { CollectionOption } from '../../_kit'
import type { MuxVideoInitSettings } from '../settings/initSettings'
import type { MuxVideoUploadSettings } from '../settings/uploadSettings'
import type { MuxVideoSignedUrlOptions } from '../settings/signedUrlOptions'

export type MuxPosterExtension = 'webp' | 'jpg' | 'png'
export type MuxAnimatedGifExtension = 'gif' | 'webp'
export type MuxAdminThumbnail = 'gif' | 'image' | 'none'
export type MuxPlaybackPolicy = 'public' | 'signed'

export type MuxAccessFn = (request: PayloadRequest) => Promise<boolean> | boolean

export interface MuxAccessOptions {
  /** Who may read videos. Defaults to a logged-in admin-collection user — an anonymous read of a
   * signed-policy video would hand out a signed playback URL. Create / update / delete fall back to
   * Payload's own. */
  read?: MuxAccessFn
  /** Who may request a direct upload (`POST` / `GET /mux/upload`). Defaults to a logged-in
   * admin-collection user. */
  upload?: MuxAccessFn
}

export interface MuxVideoCollectionOptions {
  /** The list-view thumbnail cell. Defaults to the animated `gif` preview. */
  thumbnail?: MuxAdminThumbnail
}

export interface MuxOptions {
  /** Mux credentials. Every field falls back to its `MUX_*` env var.
   *
   * - `tokenId`
   * - `tokenSecret`
   * - `webhookSecret`
   * - `jwtSigningKey`
   * - `jwtPrivateKey` */
  initSettings?: MuxVideoInitSettings
  /** Applied to every direct upload.
   *
   * - `cors_origin`
   * - `new_asset_settings` */
  uploadSettings?: MuxVideoUploadSettings
  /** Lifetime of the JWT-signed playback URLs under a signed policy.
   *
   * - `expiration` */
  signedUrlOptions?: MuxVideoSignedUrlOptions
  /** Playback policy for new uploads; `'signed'` issues JWT-signed URLs. Default `'public'`. */
  playbackPolicy?: MuxPlaybackPolicy
  /** Image format for `posterUrl`. Default `'png'`. */
  posterExtension?: MuxPosterExtension
  /** Format for the animated preview (`gifUrl`). Default `'gif'`. */
  animatedGifExtension?: MuxAnimatedGifExtension
  /** Backfill a Payload doc for an asset created outside Payload (e.g. in the Mux dashboard).
   * Off by default: one Mux account shared across environments would cross-backfill each of them. */
  autoCreateOnWebhook?: boolean
  /** Who may read videos and who may request an upload; both default to a logged-in admin user.
   *
   * - `read`
   * - `upload` */
  access?: MuxAccessOptions
}

export interface MuxVideoPluginOptions {
  /** Register nothing when false — no collection, endpoints, or hooks. Default `true`. */
  enabled?: boolean
  /** The collections this plugin registers.
   *
   * - `muxVideo` */
  collections?: {
    /** The `mux-video` collection: `slug` renames it, `overrides` is the Payload passthrough, and
     * `options` is this plugin's own knobs for it. Always registered — no `false`. */
    muxVideo?: CollectionOption<MuxVideoCollectionOptions>
  }
  /** This plugin's own knobs.
   *
   * - `initSettings`
   * - `uploadSettings`
   * - `signedUrlOptions`
   * - `playbackPolicy`
   * - `posterExtension`
   * - `animatedGifExtension`
   * - `autoCreateOnWebhook`
   * - `access` */
  options?: MuxOptions
}

/** `MuxVideoPluginOptions` with the defaults applied — same keys, same nesting. */
export interface ResolvedMuxVideoOptions {
  enabled: boolean
  collections: {
    muxVideo: {
      slug: string | undefined
      overrides: Partial<CollectionConfig> | undefined
      options: { thumbnail: MuxAdminThumbnail }
    }
  }
  options: {
    initSettings: MuxVideoInitSettings | undefined
    uploadSettings: MuxVideoUploadSettings | undefined
    signedUrlOptions: MuxVideoSignedUrlOptions | undefined
    playbackPolicy: MuxPlaybackPolicy
    posterExtension: MuxPosterExtension
    animatedGifExtension: MuxAnimatedGifExtension
    autoCreateOnWebhook: boolean
    access: { read: MuxAccessFn | undefined; upload: MuxAccessFn | undefined }
  }
}

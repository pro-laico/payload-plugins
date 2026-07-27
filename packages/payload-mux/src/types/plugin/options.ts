import type { CollectionConfig } from 'payload'

import type { CollectionOption, EndpointAccess } from '../../_kit'
import type { MuxVideoInitSettings } from '../settings/initSettings'
import type { MuxVideoUploadSettings } from '../settings/uploadSettings'
import type { MuxVideoSignedUrlOptions } from '../settings/signedUrlOptions'

export type MuxPosterExtension = 'webp' | 'jpg' | 'png'
export type MuxAnimatedGifExtension = 'gif' | 'webp'
export type MuxAdminThumbnail = 'gif' | 'image' | 'none'
export type MuxPlaybackPolicy = 'public' | 'signed'

export interface MuxAccessOptions {
  /** Who may request a direct upload (`POST` / `GET /mux/upload`). Defaults to any logged-in user.
   * Collection read/write is not here — it lives on `collections.muxVideo.overrides.access`. */
  upload?: EndpointAccess
  /** Who may post to the Mux webhook (`POST /mux/webhook`). Defaults to Mux's own signature
   * verification; override only if you terminate the signature check upstream. */
  webhook?: EndpointAccess
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
  /** Per-endpoint gates for the plugin's HTTP endpoints.
   *
   * - `upload` — direct-upload URL endpoint; defaults to any logged-in user
   * - `webhook` — Mux event receiver; defaults to Mux signature verification */
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
    access: { upload: EndpointAccess | undefined; webhook: EndpointAccess | undefined }
  }
}

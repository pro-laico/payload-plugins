import type { CollectionConfig, CollectionSlug, PayloadRequest } from 'payload'

import type { MuxVideoInitSettings } from '../settings/initSettings'
import type { MuxVideoUploadSettings } from '../settings/uploadSettings'
import type { MuxVideoSignedUrlOptions } from '../settings/signedUrlOptions'

export type MuxPosterExtension = 'webp' | 'jpg' | 'png'
export type MuxAnimatedGifExtension = 'gif' | 'webp'
export type MuxAdminThumbnail = 'gif' | 'image' | 'none'
export type MuxPlaybackPolicy = 'public' | 'signed'

export interface MuxCollectionsOptions {
  /** Merged onto the muxVideo collection. `slug` is not overridable — use `extendCollection` instead. */
  muxVideo?: Omit<Partial<CollectionConfig>, 'slug'>
}

export interface MuxAdminOptions {
  /** The list-view cell. Defaults to the animated `gif` preview. */
  thumbnail?: MuxAdminThumbnail
}

export type MuxAccessFn = (request: PayloadRequest) => Promise<boolean> | boolean

export interface MuxAccessOptions {
  /** Who may read videos. Defaults to a logged-in admin-collection user — an anonymous read of a
   * signed-policy video would hand out a signed playback URL. Ignored under `extendCollection`:
   * you own that collection's access. Create / update / delete fall back to Payload's own. */
  read?: MuxAccessFn
  /** Who may request a direct upload (`POST` / `GET /mux/upload`). Defaults to a logged-in
   * admin-collection user. */
  upload?: MuxAccessFn
}

export interface MuxVideoPluginOptions {
  enabled?: boolean
  collections?: MuxCollectionsOptions
  admin?: MuxAdminOptions
  extendCollection?: CollectionSlug
  initSettings?: MuxVideoInitSettings
  uploadSettings?: MuxVideoUploadSettings
  signedUrlOptions?: MuxVideoSignedUrlOptions
  playbackPolicy?: MuxPlaybackPolicy
  posterExtension?: MuxPosterExtension
  animatedGifExtension?: MuxAnimatedGifExtension
  /** Backfill a Payload doc for an asset created outside Payload (e.g. in the Mux dashboard).
   * Off by default: one Mux account shared across environments would cross-backfill each of them. */
  autoCreateOnWebhook?: boolean
  access?: MuxAccessOptions
}

export interface ResolvedMuxVideoOptions {
  enabled: boolean
  muxVideo: Omit<Partial<CollectionConfig>, 'slug'> | undefined
  adminThumbnail: MuxAdminThumbnail
  extendCollection: CollectionSlug | undefined
  initSettings: MuxVideoInitSettings | undefined
  uploadSettings: MuxVideoUploadSettings | undefined
  signedUrlOptions: MuxVideoSignedUrlOptions | undefined
  playbackPolicy: MuxPlaybackPolicy
  posterExtension: MuxPosterExtension
  animatedGifExtension: MuxAnimatedGifExtension
  autoCreateOnWebhook: boolean
  access: { read: MuxAccessFn | undefined; upload: MuxAccessFn | undefined }
}

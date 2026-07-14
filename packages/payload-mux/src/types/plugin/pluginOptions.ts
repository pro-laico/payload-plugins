import type { CollectionSlug, PayloadRequest } from 'payload'

import type { MuxVideoInitSettings } from '../settings/initSettings'
import type { MuxVideoUploadSettings } from '../settings/uploadSettings'
import type { MuxVideoSignedUrlOptions } from '../settings/signedUrlOptions'

export interface MuxVideoPluginOptions {
  enabled?: boolean
  initSettings?: MuxVideoInitSettings
  uploadSettings?: MuxVideoUploadSettings
  playbackPolicy?: 'public' | 'signed'
  extendCollection?: CollectionSlug
  access?: (request: PayloadRequest) => Promise<boolean> | boolean
  signedUrlOptions?: MuxVideoSignedUrlOptions
  posterExtension?: 'webp' | 'jpg' | 'png'
  animatedGifExtension?: 'gif' | 'webp'
  adminThumbnail?: 'gif' | 'image' | 'none'
  autoCreateOnWebhook?: boolean
}

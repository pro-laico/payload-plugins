import type { MuxVideoPluginOptions, ResolvedMuxVideoOptions } from './types'

export function resolveOptions(options: MuxVideoPluginOptions = {}): ResolvedMuxVideoOptions {
  return {
    enabled: options.enabled ?? true,
    muxVideo: options.collections?.muxVideo,
    adminThumbnail: options.admin?.thumbnail ?? 'gif',
    extendCollection: options.extendCollection,
    initSettings: options.initSettings,
    uploadSettings: options.uploadSettings,
    signedUrlOptions: options.signedUrlOptions,
    playbackPolicy: options.playbackPolicy ?? 'public',
    posterExtension: options.posterExtension ?? 'png',
    animatedGifExtension: options.animatedGifExtension ?? 'gif',
    autoCreateOnWebhook: options.autoCreateOnWebhook ?? false,
    access: { read: options.access?.read, upload: options.access?.upload },
  }
}

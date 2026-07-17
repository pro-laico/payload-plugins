import type { MuxVideoPluginOptions, ResolvedMuxVideoOptions } from './types'

export function resolveOptions(options: MuxVideoPluginOptions = {}): ResolvedMuxVideoOptions {
  const muxVideo = options.collections?.muxVideo
  const opts = options.options
  return {
    enabled: options.enabled ?? true,
    collections: {
      muxVideo: {
        slug: muxVideo?.slug,
        overrides: muxVideo?.overrides,
        options: { thumbnail: muxVideo?.options?.thumbnail ?? 'gif' },
      },
    },
    options: {
      initSettings: opts?.initSettings,
      uploadSettings: opts?.uploadSettings,
      signedUrlOptions: opts?.signedUrlOptions,
      playbackPolicy: opts?.playbackPolicy ?? 'public',
      posterExtension: opts?.posterExtension ?? 'png',
      animatedGifExtension: opts?.animatedGifExtension ?? 'gif',
      autoCreateOnWebhook: opts?.autoCreateOnWebhook ?? false,
      access: { read: opts?.access?.read, upload: opts?.access?.upload },
    },
  }
}

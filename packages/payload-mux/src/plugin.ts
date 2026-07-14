import Mux from '@mux/mux-node'
import { deepMerge } from 'payload'
import type { Config, Plugin } from 'payload'

import { MuxVideo } from './collections/MuxVideo'
import type { MuxVideoPluginOptions } from './types'
import { muxWebhookHandler } from './endpoints/webhook'
import { createMuxUploadHandler, getMuxUploadHandler } from './endpoints/upload'

export const muxVideoPlugin =
  (pluginOptions: MuxVideoPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    if (pluginOptions.enabled === false) return incomingConfig

    const mux = new Mux(pluginOptions.initSettings)
    const config: Config = { ...incomingConfig, custom: { ...incomingConfig.custom, payloadMux: { options: pluginOptions } } }

    const hasCreds = Boolean(
      (pluginOptions.initSettings?.tokenId ?? process.env.MUX_TOKEN_ID) &&
        (pluginOptions.initSettings?.tokenSecret ?? process.env.MUX_TOKEN_SECRET),
    )
    const collection = MuxVideo(mux, pluginOptions)
    if (!hasCreds) {
      collection.custom = { ...collection.custom, seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' }
      console.warn('[payload-mux] MUX_TOKEN_ID / MUX_TOKEN_SECRET not set — uploads, server-side ingest, and webhook handling will fail')
    }

    const signed =
      pluginOptions.playbackPolicy === 'signed' || pluginOptions.uploadSettings?.new_asset_settings?.playback_policy?.includes('signed')
    const hasSigningKeys = Boolean(
      (pluginOptions.initSettings?.jwtSigningKey ?? process.env.MUX_SIGNING_KEY) &&
        (pluginOptions.initSettings?.jwtPrivateKey ?? process.env.MUX_PRIVATE_KEY),
    )
    if (signed && !hasSigningKeys)
      console.warn('[payload-mux] signed playback is configured but MUX_SIGNING_KEY / MUX_PRIVATE_KEY not set — signed video reads will fail')

    if (pluginOptions.extendCollection) {
      const target = config.collections?.find((c) => c.slug === pluginOptions.extendCollection)
      if (!target) throw new Error(`[payload-mux] extendCollection: collection '${pluginOptions.extendCollection}' not found`)
      config.collections = [
        ...(config.collections ?? []).filter((c) => c.slug !== pluginOptions.extendCollection),
        deepMerge(collection, target),
      ]
    } else {
      config.collections = [...(config.collections ?? []), collection]
    }

    config.endpoints = [
      ...(config.endpoints ?? []),
      { method: 'post', path: '/mux/upload', handler: createMuxUploadHandler(mux, pluginOptions) },
      { method: 'get', path: '/mux/upload', handler: getMuxUploadHandler(mux, pluginOptions) },
      { method: 'post', path: '/mux/webhook', handler: muxWebhookHandler(mux, pluginOptions) },
    ]

    return config
  }

export default muxVideoPlugin

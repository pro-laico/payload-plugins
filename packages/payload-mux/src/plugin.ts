import Mux from '@mux/mux-node'
import type { Config, Plugin } from 'payload'
import { deepMerge } from 'payload'
import { MuxVideo } from './collections/MuxVideo'
import { createMuxUploadHandler, getMuxUploadHandler } from './endpoints/upload'
import { muxWebhookHandler } from './endpoints/webhook'
import type { MuxVideoPluginOptions } from './types'

/**
 * Brings Mux Video to Payload. Adds a `mux-video` collection (or extends one you name),
 * registers the upload + webhook endpoints, and wires the admin uploader. Direct uploads go
 * straight to Mux; a webhook keeps Payload in sync and deletes cascade both ways.
 *
 *   muxVideoPlugin({ enabled: true, initSettings: {...}, uploadSettings: { cors_origin } })
 */
export const muxVideoPlugin =
  (pluginOptions: MuxVideoPluginOptions): Plugin =>
  (incomingConfig: Config): Config => {
    if (pluginOptions.enabled === false) return incomingConfig

    const mux = new Mux(pluginOptions.initSettings)
    const config: Config = { ...incomingConfig }

    if (pluginOptions.extendCollection) {
      const target = config.collections?.find((c) => c.slug === pluginOptions.extendCollection)
      if (!target) throw new Error(`[payload-mux] extendCollection: collection '${pluginOptions.extendCollection}' not found`)
      config.collections = [
        ...(config.collections ?? []).filter((c) => c.slug !== pluginOptions.extendCollection),
        deepMerge(MuxVideo(mux, pluginOptions), target),
      ]
    } else {
      config.collections = [...(config.collections ?? []), MuxVideo(mux, pluginOptions)]
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

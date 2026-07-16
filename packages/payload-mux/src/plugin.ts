import Mux from '@mux/mux-node'
import { deepMerge } from 'payload'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { MuxVideo } from './collections/MuxVideo'
import { muxWebhookHandler } from './endpoints/webhook'
import type { MuxVideoPluginOptions, PayloadMuxMarker } from './types'
import { createMuxUploadHandler, getMuxUploadHandler } from './endpoints/upload'

export const muxVideoPlugin =
  (opts: MuxVideoPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return incomingConfig

    const mux = new Mux(resolved.initSettings)
    const muxVideoSlug = resolved.extendCollection ?? 'mux-video'
    const marker: PayloadMuxMarker = { options: opts, muxVideoSlug, uploadPath: '/mux/upload', webhookPath: '/mux/webhook' }
    const config: Config = { ...incomingConfig, custom: { ...incomingConfig.custom, payloadMux: marker } }

    const hasCreds = Boolean(
      (resolved.initSettings?.tokenId ?? process.env.MUX_TOKEN_ID) && (resolved.initSettings?.tokenSecret ?? process.env.MUX_TOKEN_SECRET),
    )
    const collection = deepMerge<CollectionConfig>(MuxVideo(mux, resolved), resolved.muxVideo ?? {})
    if (!hasCreds) {
      collection.custom = { ...collection.custom, seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' }
      console.warn('[payload-mux] MUX_TOKEN_ID / MUX_TOKEN_SECRET not set — uploads, server-side ingest, and webhook handling will fail')
    }

    const signed = resolved.playbackPolicy === 'signed' || resolved.uploadSettings?.new_asset_settings?.playback_policy?.includes('signed')
    const hasSigningKeys = Boolean(
      (resolved.initSettings?.jwtSigningKey ?? process.env.MUX_SIGNING_KEY) &&
        (resolved.initSettings?.jwtPrivateKey ?? process.env.MUX_PRIVATE_KEY),
    )
    if (signed && !hasSigningKeys)
      console.warn('[payload-mux] signed playback is configured but MUX_SIGNING_KEY / MUX_PRIVATE_KEY not set — signed video reads will fail')

    if (resolved.extendCollection) {
      const target = config.collections?.find((c) => c.slug === resolved.extendCollection)
      if (!target) throw new Error(`[payload-mux] extendCollection: collection '${resolved.extendCollection}' not found`)
      config.collections = [...(config.collections ?? []).filter((c) => c.slug !== resolved.extendCollection), deepMerge(collection, target)]
    } else {
      config.collections = [...(config.collections ?? []), collection]
    }

    config.endpoints = [
      ...(config.endpoints ?? []),
      { method: 'post', path: '/mux/upload', handler: createMuxUploadHandler(mux, resolved) },
      { method: 'get', path: '/mux/upload', handler: getMuxUploadHandler(mux, resolved) },
      { method: 'post', path: '/mux/webhook', handler: muxWebhookHandler(mux, resolved) },
    ]

    return config
  }

export default muxVideoPlugin

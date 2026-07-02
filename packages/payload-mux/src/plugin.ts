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
 * Credentials default to the standard `MUX_*` env vars, so `muxVideoPlugin()` is enough — pass
 * options only to override (custom env var name, playback policy, etc).
 */
export const muxVideoPlugin =
  (pluginOptions: MuxVideoPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    if (pluginOptions.enabled === false) return incomingConfig

    const mux = new Mux(pluginOptions.initSettings)
    // Expose the options on config.custom so external tooling (e.g. a seeder) can build a Mux
    // client from the already-configured credentials, given just `payload` — read by string
    // key, no import, so other packages stay decoupled from this one.
    const config: Config = { ...incomingConfig, custom: { ...incomingConfig.custom, payloadMux: { options: pluginOptions } } }

    // Without credentials the collection still registers (so generated types stay stable), but
    // ingest can't reach Mux — mark it seed-disabled so a seeder skips its definition with this
    // reason instead of failing mid-run. Set the env vars and the next seed picks it up.
    const hasCreds = Boolean(
      (pluginOptions.initSettings?.tokenId ?? process.env.MUX_TOKEN_ID) &&
        (pluginOptions.initSettings?.tokenSecret ?? process.env.MUX_TOKEN_SECRET),
    )
    const collection = MuxVideo(mux, pluginOptions)
    if (!hasCreds) {
      collection.custom = { ...collection.custom, seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' }
      console.warn('[payload-mux] MUX_TOKEN_ID / MUX_TOKEN_SECRET not set — uploads, server-side ingest, and webhook handling will fail')
    }

    // Signed playback needs the JWT key pair — without it every read of a signed video throws
    // in the virtual URL fields, so warn at boot instead of failing per-request.
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

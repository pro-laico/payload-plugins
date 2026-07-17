import Mux from '@mux/mux-node'
import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { muxWebhookHandler } from './endpoints/webhook'
import { resolveInitSettings } from './lib/initSettings'
import { assertNoFieldCollisions, mergeCollection } from './_kit'
import { MUX_VIDEO_SLUG, MuxVideo } from './collections/MuxVideo'
import type { MuxVideoPluginOptions, PayloadMuxMarker } from './types'
import { createMuxUploadHandler, getMuxUploadHandler } from './endpoints/upload'

/** Video hosting inside Payload, powered by Mux: uploads go straight to Mux, playback /
 * poster / gif URLs compute on read, and the two stay in sync.
 *
 * - `enabled`
 * - `collections`
 * - `options`
 */
export const muxVideoPlugin =
  (opts: MuxVideoPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return incomingConfig

    const initSettings = resolveInitSettings(resolved.options.initSettings)
    const mux = new Mux(initSettings)

    // Resolved once, here. `collections.muxVideo.slug` renames the collection, and everything that
    // refers to it by name follows: the webhook's lookup, and the marker that `ingestMuxVideo` and
    // any consumer read.
    const override = resolved.collections.muxVideo
    const muxVideoSlug = override.slug ?? MUX_VIDEO_SLUG

    const marker: PayloadMuxMarker = { options: opts, muxVideoSlug, uploadPath: '/mux/upload', webhookPath: '/mux/webhook' }
    const config: Config = { ...incomingConfig, custom: { ...incomingConfig.custom, payloadMux: marker } }

    const signed =
      resolved.options.playbackPolicy === 'signed' || resolved.options.uploadSettings?.new_asset_settings?.playback_policy?.includes('signed')
    const hasSigningKeys = Boolean(initSettings.jwtSigningKey && initSettings.jwtPrivateKey)
    if (signed && !hasSigningKeys)
      console.warn('[payload-mux] signed playback is configured but MUX_SIGNING_KEY / MUX_PRIVATE_KEY not set — signed video reads will fail')

    const base = MuxVideo(mux, resolved)
    assertNoFieldCollisions('payload-mux', 'muxVideo', base.fields, override.overrides?.fields)
    // `slug` is a direct key on `collections.muxVideo`, not inside `overrides`, so it isn't part of
    // the Payload passthrough the merge kit consumes — apply the rename here.
    const collection = { ...mergeCollection(base, override.overrides), slug: muxVideoSlug }

    const hasCreds = Boolean(initSettings.tokenId && initSettings.tokenSecret)
    if (!hasCreds) {
      collection.custom = { ...collection.custom, seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' }
      console.warn('[payload-mux] MUX_TOKEN_ID / MUX_TOKEN_SECRET not set — uploads, server-side ingest, and webhook handling will fail')
    }

    // No filter on the incoming collections, on purpose: an app that already has a collection on
    // this slug should fail loudly on the duplicate rather than have its own silently replaced.
    config.collections = [...(config.collections ?? []), collection]

    config.endpoints = [
      ...(config.endpoints ?? []),
      { method: 'post', path: '/mux/upload', handler: createMuxUploadHandler(mux, resolved) },
      { method: 'get', path: '/mux/upload', handler: getMuxUploadHandler(mux, resolved) },
      { method: 'post', path: '/mux/webhook', handler: muxWebhookHandler(mux, resolved, muxVideoSlug) },
    ]

    return config
  }

export default muxVideoPlugin

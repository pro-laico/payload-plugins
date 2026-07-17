import Mux from '@mux/mux-node'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { namedFields } from './lib/namedFields'
import { muxWebhookHandler } from './endpoints/webhook'
import { resolveInitSettings } from './lib/initSettings'
import { mergeCollection } from './lib/mergeCollection'
import { MuxVideo, muxEnhancements } from './collections/MuxVideo'
import type { MuxVideoPluginOptions, PayloadMuxMarker } from './types'
import { createMuxUploadHandler, getMuxUploadHandler } from './endpoints/upload'

/** Video hosting inside Payload, powered by Mux: uploads go straight to Mux, playback /
 * poster / gif URLs compute on read, and the two stay in sync.
 *
 * - `enabled`
 * - `collections`
 * - `admin`
 * - `extendCollection`
 * - `initSettings`
 * - `uploadSettings`
 * - `signedUrlOptions`
 * - `playbackPolicy`
 * - `posterExtension`
 * - `animatedGifExtension`
 * - `autoCreateOnWebhook`
 * - `access`
 */
export const muxVideoPlugin =
  (opts: MuxVideoPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return incomingConfig

    const initSettings = resolveInitSettings(resolved.initSettings)
    const mux = new Mux(initSettings)
    const muxVideoSlug = resolved.extendCollection ?? 'mux-video'
    const marker: PayloadMuxMarker = { options: opts, muxVideoSlug, uploadPath: '/mux/upload', webhookPath: '/mux/webhook' }
    const config: Config = { ...incomingConfig, custom: { ...incomingConfig.custom, payloadMux: marker } }

    const signed = resolved.playbackPolicy === 'signed' || resolved.uploadSettings?.new_asset_settings?.playback_policy?.includes('signed')
    const hasSigningKeys = Boolean(initSettings.jwtSigningKey && initSettings.jwtPrivateKey)
    if (signed && !hasSigningKeys)
      console.warn('[payload-mux] signed playback is configured but MUX_SIGNING_KEY / MUX_PRIVATE_KEY not set — signed video reads will fail')

    // Base first, then the plugin's own bits, then your `collections.muxVideo` overrides last —
    // so an override always wins, whether the collection is ours or one you're extending.
    let collections = config.collections ?? []
    let collection: CollectionConfig
    if (resolved.extendCollection) {
      const target = config.collections?.find((c) => c.slug === resolved.extendCollection)
      if (!target) throw new Error(`[payload-mux] extendCollection: collection '${resolved.extendCollection}' not found`)
      const enh = muxEnhancements(mux, resolved)
      // Fields append on merge, so a target field named like an injected one would boot-fail with
      // Payload's bare DuplicateFieldName — catch it here with a plugin-attributed error instead.
      const injected = new Set(namedFields(enh.fields ?? []))
      const collisions = namedFields(target.fields).filter((n) => injected.has(n))
      if (collisions.length)
        throw new Error(
          `[payload-mux] extendCollection: '${resolved.extendCollection}' already defines field(s) ${collisions.join(', ')} that the plugin injects — rename or remove them.`,
        )
      collection = mergeCollection(mergeCollection(target, enh), resolved.muxVideo)
      // Swap the target for the extended version, in place of the original.
      collections = collections.filter((c) => c.slug !== resolved.extendCollection)
    } else {
      // No filter here on purpose: an app that already has a `mux-video` collection should fail
      // loudly on the duplicate slug rather than have its own collection silently replaced.
      collection = mergeCollection(MuxVideo(mux, resolved), resolved.muxVideo)
    }

    const hasCreds = Boolean(initSettings.tokenId && initSettings.tokenSecret)
    if (!hasCreds) {
      collection.custom = { ...collection.custom, seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' }
      console.warn('[payload-mux] MUX_TOKEN_ID / MUX_TOKEN_SECRET not set — uploads, server-side ingest, and webhook handling will fail')
    }

    // `access.read` is the plugin's own collection's gate; an extended collection keeps its own.
    if (resolved.extendCollection && resolved.access.read)
      console.warn(
        `[payload-mux] extendCollection: option access.read is ignored — you own '${resolved.extendCollection}'s access; set read access on the collection itself.`,
      )

    config.collections = [...collections, collection]

    config.endpoints = [
      ...(config.endpoints ?? []),
      { method: 'post', path: '/mux/upload', handler: createMuxUploadHandler(mux, resolved) },
      { method: 'get', path: '/mux/upload', handler: getMuxUploadHandler(mux, resolved) },
      { method: 'post', path: '/mux/webhook', handler: muxWebhookHandler(mux, resolved) },
    ]

    return config
  }

export default muxVideoPlugin

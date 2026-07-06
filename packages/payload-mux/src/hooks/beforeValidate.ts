import type Mux from '@mux/mux-node'
import type { CollectionBeforeValidateHook } from 'payload'
import { getAssetMetadata } from '../lib/getAssetMetadata'
import { ingestMuxAsset, type MuxSource } from '../lib/ingest'
import type { MuxVideoPluginOptions } from '../types'

/** The transient `source` a caller sets to ingest server-side: a string path/URL, or an
 *  object carrying the path/URL plus per-video options. Never persisted. */
interface MuxSourceInput {
  file?: string
  url?: string
  playbackPolicy?: 'public' | 'signed'
  posterTimestamp?: number
  corsOrigin?: string
}

interface NormalizedSource {
  ref: MuxSource
  playbackPolicy?: 'public' | 'signed'
  corsOrigin?: string
  posterTimestamp?: number
}

/** Normalize a `source` value (string or object) to a ref + options, or null if unusable. */
function normalizeSource(source: unknown): NormalizedSource | null {
  if (!source) return null
  if (typeof source === 'string') return { ref: source }
  const s = source as MuxSourceInput
  const ref = s.url ?? s.file
  if (!ref) return null
  return { ref, playbackPolicy: s.playbackPolicy, corsOrigin: s.corsOrigin, posterTimestamp: s.posterTimestamp }
}

/**
 * Server-side ingest. When a doc is created (or updated) with a transient `source` (a local
 * path or `http(s)` URL) and no `assetId` yet, upload it to Mux, wait until the asset is
 * `ready`, and fold the asset id + metadata into the doc — running in `beforeValidate` so it
 * lands before `assetId`'s required check. The `source` key is always stripped so it never
 * persists. Docs that already carry an `assetId` (the admin direct-upload flow, webhook
 * backfill, or pre-resolved seed data) skip ingest entirely.
 *
 * Playback policy (and the rest of `new_asset_settings`) come from the plugin's `uploadSettings`
 * — the same config the admin direct-upload path uses — so a seeded video matches an admin-uploaded
 * one. A per-video `source.playbackPolicy` overrides it.
 */
export const getBeforeValidateHook =
  (mux: Mux, options: MuxVideoPluginOptions = {}): CollectionBeforeValidateHook =>
  async ({ data, req }) => {
    const d = (data ?? {}) as Record<string, unknown>
    if (!('source' in d)) return data

    const { source, ...rest } = d
    const norm = d.assetId ? null : normalizeSource(source)
    if (!norm) return rest

    let asset: Awaited<ReturnType<typeof ingestMuxAsset>>
    try {
      asset = await ingestMuxAsset(mux, norm.ref, {
        // Mirror the admin direct-upload path (`upload.ts`): the plugin-level `playbackPolicy`
        // shorthand is the base default, overlaid by the full `uploadSettings.new_asset_settings`,
        // with a per-video `source.playbackPolicy` winning last — so seeded and admin-uploaded
        // videos share one policy.
        newAssetSettings: { playback_policy: [options.playbackPolicy ?? 'public'], ...options.uploadSettings?.new_asset_settings },
        playbackPolicy: norm.playbackPolicy,
        corsOrigin: norm.corsOrigin ?? options.uploadSettings?.cors_origin,
      })
    } catch (err) {
      // Wrap with context: the raw error (often the Mux SDK's) names neither the doc nor the
      // plugin, which is what a seed/import consumer actually needs to see.
      const raw = err instanceof Error ? err.message : String(err)
      const inner = raw.replace(/^\[payload-mux\]\s*/, '')
      const hint = /Could not resolve authentication method/i.test(raw)
        ? ' — Mux credentials are missing; set MUX_TOKEN_ID / MUX_TOKEN_SECRET (or pass initSettings to muxVideoPlugin).'
        : ''
      const title = typeof d.title === 'string' && d.title ? d.title : '(untitled)'
      const message = `[payload-mux] ingest failed for '${title}' (source: ${norm.ref}): ${inner}${hint}`
      req.payload.logger.error({ err, msg: message })
      throw new Error(message, { cause: err })
    }
    return {
      ...rest,
      assetId: asset.id,
      ...getAssetMetadata(asset),
      // Ingest waits until the asset is ready, so the status can be stamped directly.
      status: 'ready',
      ...(norm.posterTimestamp !== undefined ? { posterTimestamp: norm.posterTimestamp } : {}),
    }
  }

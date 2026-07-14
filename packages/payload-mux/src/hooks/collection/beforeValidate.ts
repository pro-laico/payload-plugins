import type Mux from '@mux/mux-node'
import type { CollectionBeforeValidateHook } from 'payload'

import { ingestMuxAsset } from '../../lib/ingest'
import { getAssetMetadata } from '../../lib/getAssetMetadata'
import type { MuxSourceInput, MuxVideoPluginOptions, NormalizedSource } from '../../types'

function normalizeSource(source: unknown): NormalizedSource | null {
  if (!source) return null
  if (typeof source === 'string') return { ref: source }
  const s = source as MuxSourceInput //TODO: replace `as` cast with proper typing
  const ref = s.url ?? s.file
  if (!ref) return null
  return { ref, playbackPolicy: s.playbackPolicy, corsOrigin: s.corsOrigin, posterTimestamp: s.posterTimestamp }
}

export const getBeforeValidateHook =
  (mux: Mux, options: MuxVideoPluginOptions = {}): CollectionBeforeValidateHook =>
  async ({ data, req }) => {
    const d = (data ?? {}) as Record<string, unknown> //TODO: replace `as` cast with proper typing
    if (!('source' in d)) return data

    const { source, ...rest } = d
    const norm = d.assetId ? null : normalizeSource(source)
    if (!norm) return rest

    let asset: Awaited<ReturnType<typeof ingestMuxAsset>>
    try {
      asset = await ingestMuxAsset(mux, norm.ref, {
        newAssetSettings: { playback_policy: [options.playbackPolicy ?? 'public'], ...options.uploadSettings?.new_asset_settings },
        playbackPolicy: norm.playbackPolicy,
        corsOrigin: norm.corsOrigin ?? options.uploadSettings?.cors_origin,
      })
    } catch (err) {
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
      status: 'ready',
      ...(norm.posterTimestamp !== undefined ? { posterTimestamp: norm.posterTimestamp } : {}),
    }
  }

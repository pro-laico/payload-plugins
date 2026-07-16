import type Mux from '@mux/mux-node'
import type { CollectionBeforeValidateHook } from 'payload'

import { ingestMuxAsset } from '../../lib/ingest'
import { getAssetMetadata } from '../../lib/getAssetMetadata'
import { isRecord } from '../../lib/isRecord'
import type { NormalizedSource, ResolvedMuxVideoOptions } from '../../types'

function normalizeSource(source: unknown): NormalizedSource | null {
  if (!source) return null
  if (typeof source === 'string') return { ref: source }
  if (!isRecord(source)) return null
  const url = typeof source.url === 'string' ? source.url : undefined
  const file = typeof source.file === 'string' ? source.file : undefined
  const ref = url ?? file
  if (!ref) return null
  const playbackPolicy = source.playbackPolicy === 'public' || source.playbackPolicy === 'signed' ? source.playbackPolicy : undefined
  const corsOrigin = typeof source.corsOrigin === 'string' ? source.corsOrigin : undefined
  const posterTimestamp = typeof source.posterTimestamp === 'number' ? source.posterTimestamp : undefined
  return { ref, playbackPolicy, corsOrigin, posterTimestamp }
}

export const getBeforeValidateHook =
  (mux: Mux, options: ResolvedMuxVideoOptions): CollectionBeforeValidateHook =>
  async ({ data, req }) => {
    const d: Record<string, unknown> = data ?? {}
    if (!('source' in d)) return data

    const { source, ...rest } = d
    const norm = d.assetId ? null : normalizeSource(source)
    if (!norm) return rest

    let asset: Awaited<ReturnType<typeof ingestMuxAsset>>
    try {
      asset = await ingestMuxAsset(mux, norm.ref, {
        newAssetSettings: { playback_policy: [options.playbackPolicy], ...options.uploadSettings?.new_asset_settings },
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

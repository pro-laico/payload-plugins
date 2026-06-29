import type Mux from '@mux/mux-node'
import type { CollectionBeforeValidateHook } from 'payload'
import { getAssetMetadata } from '../lib/getAssetMetadata'
import { ingestMuxAsset, type MuxSource } from '../lib/ingest'

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
 */
export const getBeforeValidateHook =
  (mux: Mux): CollectionBeforeValidateHook =>
  async ({ data }) => {
    const d = (data ?? {}) as Record<string, unknown>
    if (!('source' in d)) return data

    const { source, ...rest } = d
    const norm = d.assetId ? null : normalizeSource(source)
    if (!norm) return rest

    const asset = await ingestMuxAsset(mux, norm.ref, { playbackPolicy: norm.playbackPolicy, corsOrigin: norm.corsOrigin })
    return {
      ...rest,
      assetId: asset.id,
      ...getAssetMetadata(asset),
      ...(norm.posterTimestamp !== undefined ? { posterTimestamp: norm.posterTimestamp } : {}),
    }
  }

import { readFile } from 'node:fs/promises'
import type Mux from '@mux/mux-node'
import type { CollectionSlug, Payload } from 'payload'
import type { MuxVideoNewAssetSettings } from '../types'
import { delay } from './delay'

/** A server-side video source: a local file path or an `http(s)` URL. */
export type MuxSource = string

/** Poll `fetch` until `done(value)` is true or the deadline passes; returns the last value. */
async function pollUntil<T>(fetch: () => Promise<T>, done: (value: T) => boolean, intervalMs: number, timeoutMs = 120_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let value = await fetch()
  while (!done(value) && Date.now() < deadline) {
    await delay(intervalMs)
    value = await fetch()
  }
  return value
}

/** Read a source's bytes: fetched for an `http(s)` URL, read from disk for a local path. */
async function readSourceBytes(source: MuxSource): Promise<ArrayBuffer> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`[payload-mux] failed to fetch source '${source}': ${res.status} ${res.statusText}`)
    return res.arrayBuffer()
  }
  const buf = await readFile(source)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export interface IngestMuxAssetOptions {
  /** Base new-asset settings — normally the plugin's `uploadSettings.new_asset_settings`, so a
   *  server-side ingest produces the same asset config as the admin direct-upload path. */
  newAssetSettings?: MuxVideoNewAssetSettings
  /** Playback policy override for this asset. When set, wins over `newAssetSettings`'s policy;
   *  otherwise the configured policy applies (falling back to `'public'`). */
  playbackPolicy?: 'public' | 'signed'
  /** CORS origin for the direct upload. @default '*' */
  corsOrigin?: string
}

/**
 * Resolve the `new_asset_settings` for an ingest, mirroring the admin path (`upload.ts`): a
 * `['public']` default, overlaid with the plugin's configured `newAssetSettings`, with a per-call
 * `playbackPolicy` winning last. Keeps seeded/ingested videos in sync with admin uploads.
 */
export function resolveNewAssetSettings(
  newAssetSettings?: MuxVideoNewAssetSettings,
  playbackPolicy?: 'public' | 'signed',
): MuxVideoNewAssetSettings {
  return {
    playback_policy: ['public'],
    ...newAssetSettings,
    ...(playbackPolicy ? { playback_policy: [playbackPolicy] } : {}),
  }
}

/**
 * Ingest a video into Mux server-side: create a direct upload, PUT the source bytes (from a
 * local path or an `http(s)` URL), and poll until the asset is `ready`. The programmatic
 * counterpart to the admin uploader's client-side direct upload — used for seeding, imports,
 * and migrations. Returns the ready asset.
 *
 * `new_asset_settings` are resolved by {@link resolveNewAssetSettings} — the plugin's configured
 * `newAssetSettings` over a `['public']` default, with `playbackPolicy` as a per-call override —
 * so seeded videos honor the same playback policy as admin uploads.
 */
export async function ingestMuxAsset(mux: Mux, source: MuxSource, opts: IngestMuxAssetOptions = {}): Promise<Mux.Video.Assets.Asset> {
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin ?? '*',
    new_asset_settings: resolveNewAssetSettings(opts.newAssetSettings, opts.playbackPolicy),
  })
  if (!upload.url) throw new Error(`[payload-mux] Mux did not return an upload URL for '${source}'`)

  const res = await fetch(upload.url, { method: 'PUT', body: new Blob([await readSourceBytes(source)]) })
  if (!res.ok) throw new Error(`[payload-mux] upload PUT failed for '${source}': ${res.status} ${res.statusText}`)

  const ready = await pollUntil(
    () => mux.video.uploads.retrieve(upload.id),
    (u) => Boolean(u.asset_id),
    1000,
  )
  if (!ready.asset_id) throw new Error(`[payload-mux] Mux upload '${upload.id}' never produced an asset`)

  const asset = await pollUntil(
    () => mux.video.assets.retrieve(ready.asset_id as string),
    (a) => a.status !== 'preparing',
    2000,
  )
  if (asset.status !== 'ready') throw new Error(`[payload-mux] asset '${asset.id}' did not become ready (status: ${asset.status})`)

  return asset
}

export interface IngestMuxVideoOptions {
  /** Local file path or `http(s)` URL of the video to ingest. */
  source: MuxSource
  /** Title for the created `mux-video` doc (must be unique within the collection). */
  title: string
  /** Playback policy override for the uploaded asset. @default the plugin's configured policy */
  playbackPolicy?: 'public' | 'signed'
  /** Optional poster timestamp (seconds). */
  posterTimestamp?: number
  /** The `mux-video` collection slug. @default 'mux-video' */
  collection?: string
}

/**
 * Create a `mux-video` doc from a local file or URL — the programmatic equivalent of uploading
 * through the admin uploader. Hands `source` to the collection, whose `beforeValidate` hook
 * uploads it to Mux and folds in the ready asset's metadata.
 */
export async function ingestMuxVideo(payload: Payload, opts: IngestMuxVideoOptions): Promise<{ id: string | number }> {
  const collection = (opts.collection ?? 'mux-video') as CollectionSlug
  const doc = await payload.create({
    collection,
    data: {
      title: opts.title,
      source: { file: opts.source, playbackPolicy: opts.playbackPolicy, posterTimestamp: opts.posterTimestamp },
    } as never,
    overrideAccess: true,
  })
  return doc as { id: string | number }
}

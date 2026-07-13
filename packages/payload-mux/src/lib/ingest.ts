import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type Mux from '@mux/mux-node'
import type { CollectionSlug, Payload } from 'payload'
import type { IngestMuxAssetOptions, IngestMuxVideoOptions, MuxSource, MuxVideoNewAssetSettings } from '../types'
import { delay } from './delay'

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

/** Build the PUT body for the Mux upload. A local path streams from disk with a Content-Length
 *  (so a large video never sits fully in memory); an `http(s)` URL is fetched and forwarded.
 *  Note: a URL source is buffered fully in memory before the PUT (Mux's upload endpoint needs a
 *  known length) — for very large remote files, download to disk and ingest the local path. */
async function buildUploadBody(source: MuxSource): Promise<{ body: BodyInit; headers?: Record<string, string> }> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`[payload-mux] failed to fetch source '${source}': ${res.status} ${res.statusText}`)
    return { body: new Blob([await res.arrayBuffer()]) }
  }
  const { size } = await stat(source).catch(() => {
    throw new Error(`[payload-mux] source file not found: ${source}`)
  })
  return { body: createReadStream(source) as unknown as BodyInit, headers: { 'Content-Length': String(size) } }
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

  const { body, headers } = await buildUploadBody(source)
  // `duplex: 'half'` is required when streaming a request body (the local-file path).
  const res = await fetch(upload.url, { method: 'PUT', body, headers, duplex: 'half' } as RequestInit & { duplex: 'half' })
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
  // Still `preparing` means the 120s pollUntil deadline passed, not a Mux verdict.
  if (asset.status === 'preparing') throw new Error(`[payload-mux] timed out after 120s waiting for asset '${asset.id}' (status: preparing)`)
  if (asset.status !== 'ready') {
    const detail = asset.errors?.messages?.length ? `: ${asset.errors.messages.join('; ')}` : ''
    throw new Error(`[payload-mux] asset '${asset.id}' did not become ready (status: ${asset.status})${detail}`)
  }

  return asset
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
  })
  return doc as { id: string | number }
}

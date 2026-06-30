import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type Mux from '@mux/mux-node'
import type { CollectionSlug, Payload } from 'payload'
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

/** Build the PUT body for the Mux upload. A local path streams from disk with a Content-Length
 *  (so a large video never sits fully in memory); an `http(s)` URL is fetched and forwarded. */
async function buildUploadBody(source: MuxSource): Promise<{ body: BodyInit; headers?: Record<string, string> }> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`[payload-mux] failed to fetch source '${source}': ${res.status} ${res.statusText}`)
    return { body: new Blob([await res.arrayBuffer()]) }
  }
  const { size } = await stat(source)
  return { body: createReadStream(source) as unknown as BodyInit, headers: { 'Content-Length': String(size) } }
}

export interface IngestMuxAssetOptions {
  /** Playback policy for the created asset. @default 'public' */
  playbackPolicy?: 'public' | 'signed'
  /** CORS origin for the direct upload. @default '*' */
  corsOrigin?: string
}

/**
 * Ingest a video into Mux server-side: create a direct upload, PUT the source bytes (from a
 * local path or an `http(s)` URL), and poll until the asset is `ready`. The programmatic
 * counterpart to the admin uploader's client-side direct upload — used for seeding, imports,
 * and migrations. Returns the ready asset.
 */
export async function ingestMuxAsset(mux: Mux, source: MuxSource, opts: IngestMuxAssetOptions = {}): Promise<Mux.Video.Assets.Asset> {
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin ?? '*',
    new_asset_settings: { playback_policy: [opts.playbackPolicy ?? 'public'] },
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
  if (asset.status !== 'ready') throw new Error(`[payload-mux] asset '${asset.id}' did not become ready (status: ${asset.status})`)

  return asset
}

export interface IngestMuxVideoOptions {
  /** Local file path or `http(s)` URL of the video to ingest. */
  source: MuxSource
  /** Title for the created `mux-video` doc (must be unique within the collection). */
  title: string
  /** Playback policy for the uploaded asset. @default 'public' */
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

import type Mux from '@mux/mux-node'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Payload } from 'payload'

// The fetch spec requires `duplex` when the body is a stream; TS's lib.dom RequestInit omits it.
declare global {
  interface RequestInit {
    duplex?: 'half'
  }
}

import { delay } from './delay'
import { readMuxMarker } from './marker'
import { MUX_VIDEO_SLUG } from '../collections/MuxVideo'
import type { IngestMuxAssetOptions, IngestMuxVideoOptions, MuxSource, MuxVideoNewAssetSettings } from '../types'

async function pollUntil<T>(fetch: () => Promise<T>, done: (value: T) => boolean, intervalMs: number, timeoutMs = 120_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let value = await fetch()
  while (!done(value) && Date.now() < deadline) {
    await delay(intervalMs)
    value = await fetch()
  }
  return value
}

async function buildUploadBody(source: MuxSource): Promise<{ body: BodyInit; headers?: Record<string, string> }> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`[payload-mux] failed to fetch source '${source}': ${res.status} ${res.statusText}`)
    return { body: new Blob([await res.arrayBuffer()]) }
  }
  const { size } = await stat(source).catch(() => {
    throw new Error(`[payload-mux] source file not found: ${source}`)
  })
  //EXCUSE: a Node ReadStream streams straight to undici's fetch at runtime (no buffering large videos into memory); lib.dom's BodyInit has no type for a Node stream, and the web ReadableStream from Readable.toWeb() is structurally incompatible with lib.dom
  return { body: createReadStream(source) as unknown as BodyInit, headers: { 'Content-Length': String(size) } }
}

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

export async function ingestMuxAsset(mux: Mux, source: MuxSource, opts: IngestMuxAssetOptions = {}): Promise<Mux.Video.Assets.Asset> {
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin ?? '*',
    new_asset_settings: resolveNewAssetSettings(opts.newAssetSettings, opts.playbackPolicy),
  })
  if (!upload.url) throw new Error(`[payload-mux] Mux did not return an upload URL for '${source}'`)

  const { body, headers } = await buildUploadBody(source)
  const res = await fetch(upload.url, { method: 'PUT', body, headers, duplex: 'half' })
  if (!res.ok) throw new Error(`[payload-mux] upload PUT failed for '${source}': ${res.status} ${res.statusText}`)

  const ready = await pollUntil(
    () => mux.video.uploads.retrieve(upload.id),
    (u) => Boolean(u.asset_id),
    1000,
  )
  if (!ready.asset_id) throw new Error(`[payload-mux] Mux upload '${upload.id}' never produced an asset`)
  const assetId = ready.asset_id

  const asset = await pollUntil(
    () => mux.video.assets.retrieve(assetId),
    (a) => a.status !== 'preparing',
    2000,
  )
  if (asset.status === 'preparing') throw new Error(`[payload-mux] timed out after 120s waiting for asset '${asset.id}' (status: preparing)`)
  if (asset.status !== 'ready') {
    const detail = asset.errors?.messages?.length ? `: ${asset.errors.messages.join('; ')}` : ''
    throw new Error(`[payload-mux] asset '${asset.id}' did not become ready (status: ${asset.status})${detail}`)
  }

  return asset
}

export async function ingestMuxVideo(payload: Payload, opts: IngestMuxVideoOptions): Promise<{ id: string | number }> {
  // The marker carries the slug the plugin actually registered, so a renamed collection needs no
  // `opts.collection` here — the literal is only the floor for a config the plugin never saw.
  const collection = opts.collection ?? readMuxMarker(payload.config)?.muxVideoSlug ?? MUX_VIDEO_SLUG
  const doc = await payload.create({
    collection,
    data: {
      title: opts.title,
      source: { file: opts.source, playbackPolicy: opts.playbackPolicy, posterTimestamp: opts.posterTimestamp },
    },
  })
  return { id: doc.id }
}

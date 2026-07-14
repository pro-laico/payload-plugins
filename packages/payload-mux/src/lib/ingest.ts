import type Mux from '@mux/mux-node'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type { CollectionSlug, Payload } from 'payload'

import { delay } from './delay'
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
  return { body: createReadStream(source) as unknown as BodyInit, headers: { 'Content-Length': String(size) } } //TODO: replace `as` cast with proper typing
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
  const res = await fetch(upload.url, { method: 'PUT', body, headers, duplex: 'half' } as RequestInit & { duplex: 'half' }) //TODO: replace `as` cast with proper typing
  if (!res.ok) throw new Error(`[payload-mux] upload PUT failed for '${source}': ${res.status} ${res.statusText}`)

  const ready = await pollUntil(
    () => mux.video.uploads.retrieve(upload.id),
    (u) => Boolean(u.asset_id),
    1000,
  )
  if (!ready.asset_id) throw new Error(`[payload-mux] Mux upload '${upload.id}' never produced an asset`)

  const asset = await pollUntil(
    () => mux.video.assets.retrieve(ready.asset_id as string), //TODO: replace `as` cast with proper typing
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
  const collection = (opts.collection ?? 'mux-video') as CollectionSlug //TODO: replace `as` cast with proper typing
  const doc = await payload.create({
    collection,
    data: {
      title: opts.title,
      source: { file: opts.source, playbackPolicy: opts.playbackPolicy, posterTimestamp: opts.posterTimestamp },
    } as never, //TODO: replace `as` cast with proper typing
  })
  return doc as { id: string | number } //TODO: replace `as` cast with proper typing
}

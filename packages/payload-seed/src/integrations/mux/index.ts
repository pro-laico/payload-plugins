import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Mux from '@mux/mux-node'
import { type CollectionSlug, createLocalReq, type Payload } from 'payload'
import { pollUntil, readPluginConfig, type SeedIntegrationResult, seedLog } from '../shared'

/**
 * Mux seed integration. Uploads local video files to Mux exactly as the
 * `@pro-laico/payload-mux` admin uploader does, then creates the `mux-video` docs — the easy
 * way to push content from local into a live Mux account without committing video files.
 *
 * Decoupled from `@pro-laico/payload-mux`: it imports only the third-party `@mux/mux-node` SDK
 * (a regular dependency of this package) and reads the plugin's credentials from `config.custom`
 * by string. The two packages are kept aligned by convention.
 */

export type { SeedIntegrationResult } from '../shared'

/** Mux `passthrough` value stamped on every seed-created asset, so a reseed can clear only
 *  what the seed made (not assets uploaded by hand or in the dashboard). */
export const MUX_SEED_TAG = 'payload-mux-seed'

/** Mux credentials. All optional — anything omitted is read from the standard `MUX_*`
 *  environment variables by the SDK. Defaults to the mux plugin's `config.custom.payloadMux`,
 *  then to env. */
export interface MuxInitSettings {
  tokenId?: string
  tokenSecret?: string
  webhookSecret?: string
  jwtSigningKey?: string
  jwtPrivateKey?: string
}

/** One video to seed: a local file plus the title (and optional playback policy / poster). */
export interface MuxSeedVideo {
  /** Title for the `mux-video` doc (must be unique within the collection). */
  title: string
  /** Path to the local video file, relative to `dir`. */
  file: string
  /** Playback policy for the uploaded asset. @default 'public' */
  playbackPolicy?: 'public' | 'signed'
  /** Optional poster timestamp (seconds). */
  posterTimestamp?: number
}

export interface SeedMuxVideosOptions {
  /** The videos to upload + create. */
  videos: MuxSeedVideo[]
  /** Directory the `file` paths are relative to. @default 'seed-assets' */
  dir?: string
  /** Clear before seeding. `true`/`'tagged'` removes only seed-created (tagged) assets +
   *  their docs; `'all'` wipes every asset in the Mux environment (destructive — only for a
   *  dedicated dev token). @default undefined (no clear) */
  clear?: boolean | 'tagged' | 'all'
  /** The `mux-video` collection slug. @default 'mux-video' */
  collection?: string
  /** Mux credentials. Defaults to reading `config.custom.payloadMux` (set by the mux plugin). */
  initSettings?: MuxInitSettings
  /** CORS origin for the direct upload. @default '*' */
  corsOrigin?: string
}

function getMuxClient(payload: Payload, override?: MuxInitSettings): Mux {
  const stashed = readPluginConfig<{ options?: { initSettings?: MuxInitSettings } }>(payload, 'payloadMux')
  // Any field left undefined is read from the standard MUX_* env vars by the SDK.
  return new Mux(override ?? stashed?.options?.initSettings)
}

/** Map a ready Mux asset onto the `mux-video` doc fields (aligned with the mux plugin's
 *  collection by convention). */
function assetToDoc(asset: Mux.Video.Assets.Asset) {
  const videoTrack = asset.tracks?.find((t) => t.type === 'video')
  return {
    assetId: asset.id,
    duration: asset.duration,
    aspectRatio: asset.aspect_ratio?.replace(':', '/'),
    playbackOptions: asset.playback_ids?.map((p) => ({ playbackId: p.id, playbackPolicy: p.policy })),
    ...(videoTrack ? { maxWidth: videoTrack.max_width, maxHeight: videoTrack.max_height } : {}),
  }
}

/**
 * Upload a local video file to Mux, server-side: create a direct upload, PUT the file's bytes
 * to it, then poll until the asset is `ready`. The asset is stamped with the seed tag.
 */
export async function uploadMuxVideoFromFile(
  mux: Mux,
  filePath: string,
  opts: { playbackPolicy?: 'public' | 'signed'; corsOrigin?: string } = {},
): Promise<Mux.Video.Assets.Asset> {
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin ?? '*',
    new_asset_settings: { playback_policy: [opts.playbackPolicy ?? 'public'], passthrough: MUX_SEED_TAG },
  })
  if (!upload.url) throw new Error(`[payload-seed] Mux did not return an upload URL for '${filePath}'`)

  const res = await fetch(upload.url, { method: 'PUT', body: new Uint8Array(await readFile(filePath)) })
  if (!res.ok) throw new Error(`[payload-seed] upload PUT failed for '${filePath}': ${res.status} ${res.statusText}`)

  const ready = await pollUntil(
    () => mux.video.uploads.retrieve(upload.id),
    (u) => Boolean(u.asset_id),
    { intervalMs: 1000 },
  )
  if (!ready.asset_id) throw new Error(`[payload-seed] Mux upload '${upload.id}' never produced an asset`)

  const asset = await pollUntil(
    () => mux.video.assets.retrieve(ready.asset_id as string),
    (a) => a.status !== 'preparing',
    { intervalMs: 2000 },
  )
  if (asset.status !== 'ready') throw new Error(`[payload-seed] asset '${asset.id}' did not become ready (status: ${asset.status})`)

  return asset
}

/**
 * Delete seeded videos. `scope: 'tagged'` (default) removes only assets stamped with the seed
 * tag and their `mux-video` docs; `scope: 'all'` removes every asset + doc. Docs are removed
 * via the DB layer (no hooks), then the assets are deleted. Returns the asset count deleted.
 */
export async function clearMuxSeed(payload: Payload, mux: Mux, opts: { scope?: 'tagged' | 'all'; collection?: string } = {}): Promise<number> {
  const scope = opts.scope ?? 'tagged'
  const collection = (opts.collection ?? 'mux-video') as CollectionSlug

  const ids: string[] = []
  for await (const asset of mux.video.assets.list({ limit: 100 })) {
    if (scope === 'all' || asset.passthrough === MUX_SEED_TAG) ids.push(asset.id)
  }

  const req = await createLocalReq({}, payload)
  await payload.db.deleteMany({ collection, req, where: scope === 'all' ? {} : { assetId: { in: ids } } })

  for (const id of ids) {
    try {
      await mux.video.assets.delete(id)
    } catch (err) {
      if ((err as { type?: string }).type !== 'not_found') throw err
    }
  }

  return ids.length
}

/**
 * Seed `mux-video` docs from local video files: optionally clear first, then upload each file
 * to Mux and create the doc with the ready asset's metadata. Credentials come from the mux
 * plugin's config (or `options.initSettings`), so callers pass only `payload` + the videos.
 *
 *   await seedMuxVideos(payload, { dir: 'seed-assets', clear: 'tagged', videos: [{ title, file }] })
 */
export async function seedMuxVideos(payload: Payload, options: SeedMuxVideosOptions): Promise<SeedIntegrationResult> {
  const mux = getMuxClient(payload, options.initSettings)
  const collection = (options.collection ?? 'mux-video') as CollectionSlug
  const dir = options.dir ?? 'seed-assets'

  let cleared = 0
  if (options.clear) {
    cleared = await clearMuxSeed(payload, mux, { scope: options.clear === 'all' ? 'all' : 'tagged', collection })
    seedLog(payload, `cleared ${cleared} Mux asset(s)`)
  }

  let created = 0
  for (const video of options.videos) {
    seedLog(payload, `uploading '${video.file}' to Mux...`)
    const asset = await uploadMuxVideoFromFile(mux, resolve(dir, video.file), {
      playbackPolicy: video.playbackPolicy,
      corsOrigin: options.corsOrigin,
    })
    await payload.create({
      collection,
      data: { title: video.title, posterTimestamp: video.posterTimestamp, ...assetToDoc(asset) } as never,
      overrideAccess: true,
    })
    created += 1
    seedLog(payload, `seeded '${video.title}' (asset ${asset.id})`)
  }

  return { created, cleared }
}

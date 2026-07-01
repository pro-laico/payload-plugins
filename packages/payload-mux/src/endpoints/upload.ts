import type Mux from '@mux/mux-node'
import type { PayloadHandler } from 'payload'
import { isAllowed } from '../lib/isAllowed'
import type { MuxVideoPluginOptions } from '../types'

/** `POST /api/mux/upload` — create a Mux direct-upload and return it (the admin uploader
 *  POSTs files straight to the returned URL). Gated by the plugin's `access` option. */
export const createMuxUploadHandler =
  (mux: Mux, pluginOptions: MuxVideoPluginOptions): PayloadHandler =>
  async (req) => {
    if (!(await isAllowed(pluginOptions, req))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

    const upload = await mux.video.uploads.create({
      cors_origin: pluginOptions.uploadSettings?.cors_origin ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '*',
      new_asset_settings: { playback_policy: [pluginOptions.playbackPolicy ?? 'public'], ...pluginOptions.uploadSettings?.new_asset_settings },
    })

    return Response.json(upload)
  }

/** `GET /api/mux/upload?id=…` — retrieve a direct-upload by id so the client can read the
 *  `asset_id` once Mux assigns it. Gated by the plugin's `access` option. */
export const getMuxUploadHandler =
  (mux: Mux, pluginOptions: MuxVideoPluginOptions): PayloadHandler =>
  async (req) => {
    if (!(await isAllowed(pluginOptions, req))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

    const id = req.query?.id as string | undefined
    if (!id) return Response.json({ error: 'Missing upload id.' }, { status: 400 })

    try {
      const upload = await mux.video.uploads.retrieve(id)
      return Response.json(upload)
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Failed to retrieve upload '${id}'` })
      return Response.json({ error: 'Failed to retrieve upload.' }, { status: 500 })
    }
  }

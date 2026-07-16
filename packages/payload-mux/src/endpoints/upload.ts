import type Mux from '@mux/mux-node'
import type { PayloadHandler } from 'payload'

import { isAllowed } from '../lib/isAllowed'
import type { ResolvedMuxVideoOptions } from '../types'

export const createMuxUploadHandler =
  (mux: Mux, options: ResolvedMuxVideoOptions): PayloadHandler =>
  async (req) => {
    if (!(await isAllowed(options.access.upload, req))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

    try {
      const upload = await mux.video.uploads.create({
        cors_origin: options.uploadSettings?.cors_origin ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '*',
        new_asset_settings: { playback_policy: [options.playbackPolicy], ...options.uploadSettings?.new_asset_settings },
      })
      return Response.json(upload)
    } catch (err) {
      req.payload.logger.error({ err, msg: '[payload-mux] Failed to create upload' })
      return Response.json({ error: 'Failed to create upload.' }, { status: 500 })
    }
  }

export const getMuxUploadHandler =
  (mux: Mux, options: ResolvedMuxVideoOptions): PayloadHandler =>
  async (req) => {
    if (!(await isAllowed(options.access.upload, req))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

    const id = typeof req.query?.id === 'string' ? req.query.id : undefined
    if (!id) return Response.json({ error: 'Missing upload id.' }, { status: 400 })

    try {
      const upload = await mux.video.uploads.retrieve(id)
      return Response.json(upload)
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Failed to retrieve upload '${id}'` })
      return Response.json({ error: 'Failed to retrieve upload.' }, { status: 500 })
    }
  }

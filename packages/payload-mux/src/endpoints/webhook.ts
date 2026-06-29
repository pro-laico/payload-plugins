import type Mux from '@mux/mux-node'
import type { CollectionSlug, PayloadHandler } from 'payload'
import { getAssetMetadata } from '../lib/getAssetMetadata'
import type { MuxVideoPluginOptions } from '../types'

const ok = () => new Response('Success!', { status: 200 })
const noop = () => new Response('Error', { status: 204 })

/**
 * `POST /api/mux/webhook` — keep Payload in sync with Mux. Verifies the Mux signature, then:
 * sets metadata on `video.asset.ready` / `updated`, deletes the doc on `video.asset.deleted`,
 * logs on `video.asset.errored`, and (when `autoCreateOnWebhook`) backfills a doc for an
 * asset Payload doesn't have yet. Always 200s after a verified event so Mux stops retrying.
 */
export const muxWebhookHandler =
  (mux: Mux, pluginOptions: MuxVideoPluginOptions): PayloadHandler =>
  async (req) => {
    if (!req.json) return Response.json({ error: 'Bad request.' }, { status: 400 })

    const body = await req.json()
    if (!body) return Response.json({ error: 'Bad request.' }, { status: 400 })

    try {
      mux.webhooks.verifySignature(JSON.stringify(body), req.headers)
    } catch (err) {
      req.payload.logger.error({ err, msg: '[payload-mux] Webhook signature verification failed' })
      return Response.json({ error: 'Invalid signature.' }, { status: 401 })
    }

    const collection = ((pluginOptions.extendCollection as string) ?? 'mux-video') as CollectionSlug
    const event = body as { type?: string; data?: Record<string, unknown>; object?: { id?: string } }
    const assetId = event.object?.id

    const videos = await req.payload.find({ collection, where: { assetId: { equals: assetId } }, limit: 1, pagination: false })
    const video = videos.totalDocs > 0 ? videos.docs[0] : null

    if (!video) {
      const backfillable = event.type === 'video.asset.created' || event.type === 'video.asset.ready' || event.type === 'video.asset.updated'
      if (pluginOptions.autoCreateOnWebhook && backfillable && event.data) {
        try {
          const meta = event.data.meta as { title?: string } | undefined
          await req.payload.create({
            collection,
            data: { title: meta?.title || assetId, assetId, ...getAssetMetadata(event.data as never) } as never,
          })
        } catch (err) {
          req.payload.logger.error({ err, msg: `[payload-mux] Failed to backfill asset '${assetId}'` })
          return noop()
        }
      }
      return ok()
    }

    try {
      switch (event.type) {
        case 'video.asset.ready':
        case 'video.asset.updated':
          await req.payload.update({ collection, id: video.id, data: { ...getAssetMetadata(event.data as never) } as never })
          break
        case 'video.asset.deleted':
          await req.payload.delete({ collection, id: video.id })
          break
        case 'video.asset.errored':
          if (event.data?.errors) req.payload.logger.error({ assetId, errors: event.data.errors, msg: '[payload-mux] Asset errored' })
          break
        default:
          break
      }
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Failed to handle '${event.type}' for asset '${assetId}'` })
      return noop()
    }

    return ok()
  }

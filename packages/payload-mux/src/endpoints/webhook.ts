import type Mux from '@mux/mux-node'
import type { CollectionSlug, PayloadHandler } from 'payload'

import { getAssetMetadata } from '../lib/getAssetMetadata'
import type { AssetLike, MuxVideoPluginOptions } from '../types'

const fail = () => new Response('Error', { status: 500 })
const ok = () => new Response('Success!', { status: 200 })

let verifiedLogged = false

export const muxWebhookHandler =
  (mux: Mux, pluginOptions: MuxVideoPluginOptions): PayloadHandler =>
  async (req) => {
    if (!req.json) return Response.json({ error: 'Bad request.' }, { status: 400 })

    const body = await req.json()
    if (!body) return Response.json({ error: 'Bad request.' }, { status: 400 })

    let event: Awaited<ReturnType<typeof mux.webhooks.unwrap>>
    try {
      event = await mux.webhooks.unwrap(JSON.stringify(body), req.headers)
    } catch (err) {
      const hint = 'check that MUX_WEBHOOK_SECRET matches the signing secret in the Mux dashboard'
      req.payload.logger.error({ err, msg: `[payload-mux] Webhook signature verification failed — ${hint}` })
      return Response.json({ error: `Invalid signature — ${hint}.` }, { status: 401 })
    }

    if (!verifiedLogged) {
      verifiedLogged = true
      req.payload.logger.info('[payload-mux] webhook verified — receiving Mux events')
    }

    const collection = ((pluginOptions.extendCollection as string) ?? 'mux-video') as CollectionSlug //TODO: replace `as` casts with proper typing
    const assetId = event.object.id

    const videos = await req.payload.find({ collection, where: { assetId: { equals: assetId } }, limit: 1, pagination: false })
    const video = videos.totalDocs > 0 ? videos.docs[0] : null

    if (!video) {
      const backfillable = event.type === 'video.asset.created' || event.type === 'video.asset.ready' || event.type === 'video.asset.updated'
      if (pluginOptions.autoCreateOnWebhook && backfillable) {
        try {
          const title = (event.data as { meta?: { title?: string } }).meta?.title || assetId //TODO: replace `as` cast with proper typing
          const metadata = getAssetMetadata(event.data as AssetLike) //TODO: replace `as` cast with proper typing
          const status = metadata.playbackOptions?.length ? 'ready' : 'preparing'
          await req.payload.create({ collection, data: { title, assetId, ...metadata, status } as never }) //TODO: replace `as` cast with proper typing
        } catch (err) {
          req.payload.logger.error({ err, msg: `[payload-mux] Failed to backfill asset '${assetId}'` })
          return fail()
        }
      }
      return ok()
    }

    try {
      switch (event.type) {
        case 'video.asset.ready':
        case 'video.asset.updated': {
          const metadata = getAssetMetadata(event.data)
          const status = metadata.playbackOptions?.length ? { status: 'ready', error: null } : {}
          await req.payload.update({ collection, id: video.id, data: { ...metadata, ...status } as never }) //TODO: replace `as` cast with proper typing
          break
        }
        case 'video.asset.deleted':
          await req.payload.delete({ collection, id: video.id })
          break
        case 'video.asset.errored': {
          req.payload.logger.error({ assetId, errors: event.data.errors, msg: '[payload-mux] Asset errored' })
          const error = event.data.errors?.messages?.join('; ') || event.data.errors?.type || 'Unknown Mux error'
          await req.payload.update({ collection, id: video.id, data: { status: 'errored', error } as never }) //TODO: replace `as` cast with proper typing
          break
        }
        default:
          break
      }
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Failed to handle '${event.type}' for asset '${assetId}'` })
      return fail()
    }

    return ok()
  }

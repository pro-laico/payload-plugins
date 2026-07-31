import type Mux from '@mux/mux-node'
import type { PayloadHandler } from 'payload'

import { isAllowed, isRecord } from '../_kit'
import { getAssetMetadata } from '../lib/getAssetMetadata'
import type { ResolvedMuxVideoOptions } from '../types'

/**
 * Asks Mux whether a document's asset has finished encoding, and writes the answer.
 *
 * Encoding completes as a webhook, so a document whose webhook never arrives — a local machine Mux
 * can't reach, a wrong signing secret, downtime — keeps a `preparing` status forever with no way to
 * correct itself. This gives the admin a way to ask directly. It writes only when the answer has
 * changed, so polling it is cheap and leaves no trail of no-op updates.
 */
export const muxRefreshHandler =
  (mux: Mux, options: ResolvedMuxVideoOptions, collection: string): PayloadHandler =>
  async (req) => {
    if (!(await isAllowed(options.options.access.refresh, req))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

    const id = typeof req.query?.id === 'string' ? req.query.id : undefined
    if (!id) return Response.json({ error: 'Missing document id.' }, { status: 400 })

    let doc: unknown
    try {
      doc = await req.payload.findByID({ collection, id, depth: 0, req })
    } catch {
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    const record = isRecord(doc) ? doc : {}
    const assetId = typeof record.assetId === 'string' ? record.assetId : undefined
    if (!assetId) return Response.json({ error: 'That document has no Mux asset.' }, { status: 400 })
    if (record.status === 'ready' || record.status === 'errored') return Response.json({ status: record.status, changed: false })

    try {
      const asset = await mux.video.assets.retrieve(assetId)
      if (asset.status === 'errored') {
        const error = asset.errors?.messages?.join('; ') || asset.errors?.type || 'Unknown Mux error'
        await req.payload.update({ collection, id, data: { status: 'errored', error }, req })
        return Response.json({ status: 'errored', changed: true, error })
      }
      const metadata = getAssetMetadata(asset)
      if (asset.status !== 'ready' || !metadata.playbackOptions?.length) return Response.json({ status: 'preparing', changed: false })

      await req.payload.update({ collection, id, data: { ...metadata, status: 'ready', error: null }, req })
      return Response.json({ status: 'ready', changed: true })
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Could not refresh Mux asset '${assetId}'` })
      return Response.json({ error: 'Could not reach Mux.' }, { status: 502 })
    }
  }

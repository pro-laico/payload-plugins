import type Mux from '@mux/mux-node'
import type { CollectionBeforeChangeHook } from 'payload'

import { delay } from '../../lib/delay'
import { getAssetMetadata } from '../../lib/getAssetMetadata'

const POLL_INTERVAL_MS = 1500
const POLL_LIMIT_MS = 6000

export const getBeforeChangeHook =
  (mux: Mux): CollectionBeforeChangeHook =>
  async ({ req, data: incomingData, operation, originalDoc, collection }) => {
    let data = { ...incomingData }
    const previousAssetId: string | undefined = originalDoc?.assetId

    if (data.assetId && Array.isArray(data.playbackOptions) && data.playbackOptions.length > 0) return data

    if (previousAssetId === data.assetId) {
      // Same asset, but no playback options — the doc never got its `video.asset.ready` webhook
      // (bad secret, downtime, wrong URL) and the upload hook's short poll timed out. Heal it from
      // Mux so a plain re-save is a recovery, rather than leaving the doc `preparing` forever.
      if (!data.assetId || data.status === 'errored') return data
      try {
        const asset = await mux.video.assets.retrieve(data.assetId)
        const metadata = getAssetMetadata(asset)
        // Only `ready` once it actually has playback options — same guard the webhook applies.
        // Without it a policy-less asset would be marked ready with nothing to play, and every
        // later save would fall back in here and re-hit Mux.
        if (asset.status === 'ready' && metadata.playbackOptions?.length) return { ...data, ...metadata, status: 'ready', error: null }
        if (asset.status === 'errored')
          return { ...data, status: 'errored', error: asset.errors?.messages?.join('; ') || asset.errors?.type || 'Unknown Mux error' }
      } catch (err) {
        // Best-effort: the doc is already stuck, so a Mux outage must not also block the edit.
        req.payload.logger.error({ err, msg: `[payload-mux] Could not refresh Mux asset '${data.assetId}' — leaving the doc as-is` })
      }
      return data
    }

    try {
      if (operation === 'update' && previousAssetId) {
        await mux.video.assets.delete(previousAssetId)
      }

      let asset = await mux.video.assets.retrieve(data.assetId)
      const timeout = Date.now() + POLL_LIMIT_MS
      while (asset.status === 'preparing' && Date.now() < timeout) {
        await delay(POLL_INTERVAL_MS)
        asset = await mux.video.assets.retrieve(data.assetId)
      }

      if (asset.status === 'errored') {
        await mux.video.assets.delete(data.assetId)
        throw new Error(`Unable to prepare Mux asset (status: ${asset.status}). It's been deleted, please try again.`)
      }

      if (asset.status === 'ready') {
        data = { ...data, ...getAssetMetadata(asset), status: 'ready', error: null }
      } else {
        data = { ...data, status: 'preparing', error: null }
      }

      const base = typeof data.title === 'string' ? data.title : ''
      let uniqueTitle = base
      for (let n = 1; ; n++) {
        const titleClause = { title: { equals: uniqueTitle } }
        const where =
          operation === 'update' && originalDoc?.id != null ? { and: [titleClause, { id: { not_equals: originalDoc.id } }] } : titleClause
        const { totalDocs } = await req.payload.count({ collection: collection.slug, where })
        if (totalDocs === 0) break
        uniqueTitle = `${base} (${n})`
      }
      data.title = uniqueTitle

      if (collection.upload) {
        data.url = ''
        data.filename = uniqueTitle
      }
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Error preparing Mux asset for '${data.filename ?? data.title}'` })
      throw err
    }

    return data
  }

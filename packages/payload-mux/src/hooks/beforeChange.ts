import type Mux from '@mux/mux-node'
import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'
import { delay } from '../lib/delay'
import { getAssetMetadata } from '../lib/getAssetMetadata'

/** Poll a freshly-uploaded asset for up to this long before handing off to the webhook. */
const POLL_INTERVAL_MS = 1500
const POLL_LIMIT_MS = 6000

/**
 * When a doc's `assetId` is set or changed: delete the previous asset (on update), fetch the
 * new asset, briefly poll while it's `preparing`, and fold its metadata into the doc. A
 * still-`preparing` asset is left for the webhook to finish; an `errored` asset is deleted
 * and the save rejected. The doc's `filename`/`title` are made unique (the upload collection
 * requires a unique filename).
 */
export const getBeforeChangeHook =
  (mux: Mux, collection: string): CollectionBeforeChangeHook =>
  async ({ req, data: incomingData, operation, originalDoc }) => {
    let data = { ...incomingData }
    const previousAssetId: string | undefined = originalDoc?.assetId

    // Pre-resolved data (seed / import / webhook backfill): the doc already carries its
    // assetId and playback options, so there's nothing to fetch from Mux. Pass it through.
    if (data.assetId && Array.isArray(data.playbackOptions) && data.playbackOptions.length > 0) return data

    if (previousAssetId === data.assetId) return data

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
        data = { ...data, ...getAssetMetadata(asset) }
      }

      // Override Payload's built-in upload file data; the "file" is the Mux asset.
      data.url = ''

      // The filename must be unique, so de-dupe the title and mirror it onto filename.
      const existing = await req.payload.find({
        collection: collection as CollectionSlug,
        where: { title: { contains: data.title } },
        pagination: false,
      })
      const uniqueTitle = `${data.title}${existing.totalDocs > 0 ? ` (${existing.totalDocs})` : ''}`
      data.title = uniqueTitle
      data.filename = uniqueTitle
    } catch (err) {
      req.payload.logger.error({ err, msg: `[payload-mux] Error preparing Mux asset for '${data.filename ?? data.title}'` })
      throw err
    }

    return data
  }

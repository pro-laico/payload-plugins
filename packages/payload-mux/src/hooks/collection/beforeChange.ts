import type Mux from '@mux/mux-node'
import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'
import { delay } from '../../lib/delay'
import { getAssetMetadata } from '../../lib/getAssetMetadata'

/** Poll a freshly-uploaded asset for up to this long before handing off to the webhook. */
const POLL_INTERVAL_MS = 1500
const POLL_LIMIT_MS = 6000

/**
 * When a doc's `assetId` is set or changed: delete the previous asset (on update), fetch the
 * new asset, briefly poll while it's `preparing`, and fold its metadata + `status` into the
 * doc. A still-`preparing` asset is left for the webhook to finish; an `errored` asset is deleted
 * and the save rejected. The doc's `filename`/`title` are made unique (the upload collection
 * requires a unique filename).
 */
export const getBeforeChangeHook =
  (mux: Mux): CollectionBeforeChangeHook =>
  async ({ req, data: incomingData, operation, originalDoc, collection }) => {
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
        data = { ...data, ...getAssetMetadata(asset), status: 'ready', error: null }
      } else {
        // Still preparing after the short poll — the webhook flips the status to 'ready'.
        data = { ...data, status: 'preparing', error: null }
      }

      // `title` is unique: probe `base`, then `base (1)`, `base (2)` … until one is free.
      // Exact-match probing avoids counting unrelated titles, and excluding the current doc
      // (on update) keeps a replace-the-video save from renaming itself.
      const base = data.title as string
      let uniqueTitle = base
      for (let n = 1; ; n++) {
        const titleClause = { title: { equals: uniqueTitle } }
        const where =
          operation === 'update' && originalDoc?.id != null ? { and: [titleClause, { id: { not_equals: originalDoc.id } }] } : titleClause
        const { totalDocs } = await req.payload.count({ collection: collection.slug as CollectionSlug, where })
        if (totalDocs === 0) break
        uniqueTitle = `${base} (${n})`
      }
      data.title = uniqueTitle

      // When extending an actual upload collection, the Mux asset stands in for the file: blank
      // the url and mirror the unique title onto the (required, unique) filename. No-op for the
      // default `mux-video` collection, which is not an upload collection and has neither field.
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

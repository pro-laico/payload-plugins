import type Mux from '@mux/mux-node'
import type { CollectionBeforeChangeHook } from 'payload'

import { delay } from '../../lib/delay'
import { getAssetMetadata } from '../../lib/getAssetMetadata'

const POLL_INTERVAL_MS = 1500
const POLL_LIMIT_MS = 6000

/** Drops absent keys so a still-encoding asset can contribute what it knows without blanking the
 * fields it doesn't — a `preparing` asset has its playback ids but not yet duration or tracks. */
const known = <T extends object>(metadata: T): Partial<T> =>
  Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== undefined)) as Partial<T>

export const getBeforeChangeHook =
  (mux: Mux): CollectionBeforeChangeHook =>
  async ({ req, data: incomingData, operation, originalDoc, collection }) => {
    let data = { ...incomingData }
    const previousAssetId: string | undefined = originalDoc?.assetId

    // Settled: has something to play, and isn't sitting in the one state that means Mux hasn't
    // finished. Keyed on `preparing` rather than on `!== 'ready'` so a document that simply never
    // carried a status — a seed, a programmatic create supplying its own playback options — isn't
    // dragged to Mux on every save.
    const settled = Array.isArray(data.playbackOptions) && data.playbackOptions.length > 0 && data.status !== 'preparing'
    if (data.assetId && settled) return data

    if (previousAssetId === data.assetId) {
      // Same asset, not settled — either the upload hook's poll timed out before Mux finished, or
      // the `video.asset.ready` webhook never arrived (bad secret, downtime, wrong URL). Refresh
      // from Mux so a plain re-save is a recovery rather than leaving the doc stuck.
      if (!data.assetId || data.status === 'errored') return data
      try {
        const asset = await mux.video.assets.retrieve(data.assetId)
        if (asset.status === 'errored')
          return { ...data, status: 'errored', error: asset.errors?.messages?.join('; ') || asset.errors?.type || 'Unknown Mux error' }
        // Only `ready` once it actually has playback options — a policy-less asset would otherwise
        // be marked ready with nothing to play.
        const metadata = known(getAssetMetadata(asset))
        const ready = asset.status === 'ready' && metadata.playbackOptions?.length
        return { ...data, ...metadata, ...(ready ? { status: 'ready', error: null } : {}) }
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

      // Take whatever the asset already knows, ready or not. Mux assigns playback ids when it
      // creates the asset — well before encoding finishes — so discarding this on a slow encode
      // would leave the doc with nothing to play and make the webhook the only thing that could
      // ever supply it. Status alone waits for `ready`.
      data = { ...data, ...known(getAssetMetadata(asset)), status: asset.status === 'ready' ? 'ready' : 'preparing', error: null }

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

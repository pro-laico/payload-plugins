import type Mux from '@mux/mux-node'
import type { CollectionAfterDeleteHook } from 'payload'

/** When a video doc is deleted in Payload, delete its asset in Mux too. If the asset was
 *  already removed in Mux (a `not_found`), that's fine — nothing to do. */
export const getAfterDeleteHook =
  (mux: Mux): CollectionAfterDeleteHook =>
  async ({ doc }) => {
    const assetId = (doc as { assetId?: string }).assetId
    if (!assetId) return

    try {
      await mux.video.assets.delete(assetId)
    } catch (err) {
      if ((err as { type?: string }).type !== 'not_found') throw err
    }
  }

import type Mux from '@mux/mux-node'
import type { CollectionAfterDeleteHook } from 'payload'

export const getAfterDeleteHook =
  (mux: Mux): CollectionAfterDeleteHook =>
  async ({ doc }) => {
    const assetId = (doc as { assetId?: string }).assetId //TODO: replace `as` cast with proper typing
    if (!assetId) return

    try {
      await mux.video.assets.delete(assetId)
    } catch (err) {
      if ((err as { type?: string }).type !== 'not_found') throw err //TODO: replace `as` cast with proper typing
    }
  }

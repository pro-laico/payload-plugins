import type Mux from '@mux/mux-node'
import type { CollectionAfterDeleteHook } from 'payload'

import { isRecord } from '../../_kit'

export const getAfterDeleteHook =
  (mux: Mux): CollectionAfterDeleteHook =>
  async ({ doc }) => {
    const assetId = typeof doc.assetId === 'string' ? doc.assetId : undefined
    if (!assetId) return

    try {
      await mux.video.assets.delete(assetId)
    } catch (err) {
      if (!isRecord(err) || err.type !== 'not_found') throw err
    }
  }

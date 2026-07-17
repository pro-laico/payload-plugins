import type { CollectionAfterReadHook } from 'payload'

import { isRecord } from '../../_kit'

export const servedFilesHook =
  (optimizedSlug: string): CollectionAfterReadHook =>
  async ({ doc, findMany, req }) => {
    if (findMany || !req?.payload || !isRecord(doc)) return doc
    const id = typeof doc.id === 'string' || typeof doc.id === 'number' ? doc.id : undefined
    if (id == null) return doc
    try {
      const { totalDocs } = await req.payload.count({
        collection: optimizedSlug,
        where: { font: { equals: id } },
        req,
      })
      doc.servedFiles = totalDocs
    } catch (err) {
      req.payload.logger.warn({ msg: `[payload-fonts] could not count served files for typeface ${id}`, err })
    }
    return doc
  }

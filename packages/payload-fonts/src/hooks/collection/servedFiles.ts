import type { CollectionAfterReadHook, CollectionSlug } from 'payload'

export const servedFilesHook =
  (optimizedSlug: string): CollectionAfterReadHook =>
  async ({ doc, findMany, req }) => {
    if (findMany || !req?.payload) return doc
    const id = (doc as { id?: string | number }).id //TODO: replace `as` cast with proper typing
    if (id == null) return doc
    try {
      const { totalDocs } = await req.payload.count({
        collection: optimizedSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
        where: { font: { equals: id } },
        req,
      })
      ;(doc as Record<string, unknown>).servedFiles = totalDocs //TODO: replace `as` cast with proper typing
    } catch (err) {
      req.payload.logger.warn({ msg: `[payload-fonts] could not count served files for typeface ${id}`, err })
    }
    return doc
  }

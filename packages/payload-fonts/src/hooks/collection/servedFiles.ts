import type { CollectionAfterReadHook, CollectionSlug } from 'payload'

/**
 * `afterRead`: report how many served `fontOptimized` files this typeface produced, so an editor can
 * see at a glance whether optimization succeeded — `0` means nothing was served (a swap/re-save is
 * due, or the upload failed to subset). Skipped on list reads (`findMany`) so it's one count query
 * on the edit view, not one per row. Populates the virtual `servedFiles` sidebar field.
 */
export const servedFilesHook =
  (optimizedSlug: string): CollectionAfterReadHook =>
  async ({ doc, findMany, req }) => {
    if (findMany || !req?.payload) return doc
    const id = (doc as { id?: string | number }).id
    if (id == null) return doc
    try {
      const { totalDocs } = await req.payload.count({
        collection: optimizedSlug as CollectionSlug,
        where: { font: { equals: id } },
        req,
      })
      ;(doc as Record<string, unknown>).servedFiles = totalDocs
    } catch (err) {
      // A count failure shouldn't break the read — leave servedFiles unset, but say so: silence
      // here made a broken optimized collection indistinguishable from "nothing served yet".
      req.payload.logger.warn({ msg: `[payload-fonts] could not count served files for typeface ${id}`, err })
    }
    return doc
  }

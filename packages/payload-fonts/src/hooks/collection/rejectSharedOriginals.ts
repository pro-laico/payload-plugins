import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { originalIdsFromDoc } from '../../lib/fontDoc'
import { isRecord } from '../../lib/isRecord'

const idOf = (v: unknown): string | number | undefined =>
  isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number') ? v.id : undefined

export const makeRejectSharedOriginals =
  (fontSlug: string): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    if (!data || !req?.payload) return data
    const ids = originalIdsFromDoc(isRecord(data) ? data : {})
    if (ids.length === 0) return data
    const selfId = idOf(originalDoc) ?? idOf(data)
    const refs = [{ 'variable.upright': { in: ids } }, { 'variable.italic': { in: ids } }, { 'weights.file': { in: ids } }]
    const where = selfId != null ? { and: [{ id: { not_equals: selfId } }, { or: refs }] } : { or: refs }
    const res = await req.payload.find({
      collection: fontSlug,
      //EXCUSE: dotted field paths (variable.upright, weights.file) on a runtime-configured collection aren't statically expressible in Payload's Where type
      where: where as never,
      depth: 0,
      limit: 1,
      req,
    })
    if (res.totalDocs > 0) {
      const other = (typeof res.docs[0]?.title === 'string' ? res.docs[0].title : '') || 'another typeface'
      throw new APIError(
        `That font file is already used by ${other}. Each typeface needs its own upload — add a fresh copy for this slot.`,
        400,
        null,
        true,
      )
    }
    return data
  }

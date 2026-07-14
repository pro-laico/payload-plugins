import { APIError, type CollectionBeforeValidateHook, type CollectionSlug } from 'payload'

import { originalIdsFromDoc } from '../../lib/fontDoc'

export const makeRejectSharedOriginals =
  (fontSlug: string): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    if (!data || !req?.payload) return data
    const ids = originalIdsFromDoc(data as Record<string, unknown>) //TODO: replace `as` cast with proper typing
    if (ids.length === 0) return data
    //TODO: replace `as` casts with proper typing
    const selfId = (originalDoc as { id?: string | number } | undefined)?.id ?? (data as { id?: string | number }).id
    const refs = [{ 'variable.upright': { in: ids } }, { 'variable.italic': { in: ids } }, { 'weights.file': { in: ids } }]
    const where = selfId != null ? { and: [{ id: { not_equals: selfId } }, { or: refs }] } : { or: refs }
    const res = await req.payload.find({
      collection: fontSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
      where: where as never, //TODO: replace `as` cast with proper typing
      depth: 0,
      limit: 1,
      req,
    })
    if (res.totalDocs > 0) {
      const other = (res.docs[0] as { title?: string }).title || 'another typeface' //TODO: replace `as` cast with proper typing
      throw new APIError(
        `That font file is already used by ${other}. Each typeface needs its own upload — add a fresh copy for this slot.`,
        400,
        null,
        true,
      )
    }
    return data
  }

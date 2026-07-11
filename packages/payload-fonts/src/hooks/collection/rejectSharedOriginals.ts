import { APIError, type CollectionBeforeValidateHook, type CollectionSlug } from 'payload'

import { originalIdsFromDoc } from '../../lib/fontDoc'

/**
 * `beforeValidate`: enforce one `fontOriginal` per typeface — reject a save that references an
 * original already used by ANOTHER typeface. The create-only upload slots make sharing
 * impossible from the admin UI, but this is the data-layer guarantee (covers the REST API,
 * imports, seeds, and a future Payload upgrade that might un-hide "Choose from existing"). It's
 * what makes the direct asset cleanup in {@link cleanupFontAssetsHook} /
 * {@link optimizeFromOriginalsHook} safe: a de-referenced or deleted original is never still in
 * use elsewhere.
 */
export const makeRejectSharedOriginals =
  (fontSlug: string): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    if (!data || !req?.payload) return data
    const ids = originalIdsFromDoc(data as Record<string, unknown>)
    if (ids.length === 0) return data
    const selfId = (originalDoc as { id?: string | number } | undefined)?.id ?? (data as { id?: string | number }).id
    const refs = [{ 'variable.upright': { in: ids } }, { 'variable.italic': { in: ids } }, { 'weights.file': { in: ids } }]
    const where = selfId != null ? { and: [{ id: { not_equals: selfId } }, { or: refs }] } : { or: refs }
    const res = await req.payload.find({
      collection: fontSlug as CollectionSlug,
      where: where as never,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })
    if (res.totalDocs > 0) {
      const other = (res.docs[0] as { title?: string }).title || 'another typeface'
      throw new APIError(
        `That font file is already used by ${other}. Each typeface needs its own upload — add a fresh copy for this slot.`,
        400,
        null,
        true,
      )
    }
    return data
  }

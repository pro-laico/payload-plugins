import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import type { UploadDocLike } from '../../lib/transform/source'

/** A source image doc as the transform handler consumes it — upload fields plus focal/crop. */
export type SourceDoc = UploadDocLike & {
  id: string | number
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

/** Read a source doc by id, honoring the given user's access (null on any miss/error). */
export const readSourceDoc = async (
  payload: Payload,
  sourceSlug: CollectionSlug,
  id: string,
  user: PayloadRequest['user'],
): Promise<SourceDoc | null> => {
  try {
    //EXCUSE: a doc of a runtime-configured collection is untyped; downstream reads are null-guarded
    return (await payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user })) as unknown as SourceDoc
  } catch {
    return null
  }
}

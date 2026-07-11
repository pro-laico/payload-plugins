import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import type { SourceDoc } from '../../types'

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

import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import type { SourceDoc } from '../../types'

export const readSourceDoc = async (
  payload: Payload,
  sourceSlug: CollectionSlug,
  id: string,
  user: PayloadRequest['user'],
): Promise<SourceDoc | null> => {
  try {
    return (await payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user })) as unknown as SourceDoc //TODO: replace `as` cast with proper typing
  } catch {
    return null
  }
}

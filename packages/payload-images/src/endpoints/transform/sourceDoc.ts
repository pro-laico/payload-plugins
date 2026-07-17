import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import { isRecord } from '../../_kit'
import type { SourceDoc } from '../../types'

const isSourceDoc = (v: unknown): v is SourceDoc => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')

export const readSourceDoc = async (
  payload: Payload,
  sourceSlug: CollectionSlug,
  id: string,
  user: PayloadRequest['user'],
): Promise<SourceDoc | null> => {
  try {
    const raw = await payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user })
    return isSourceDoc(raw) ? raw : null
  } catch {
    return null
  }
}

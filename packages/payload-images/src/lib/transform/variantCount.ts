import type { Payload } from 'payload'

import { asSlug } from '../../_kit'

export const countVariantsForSource = async (payload: Payload, variantSlug: string, sourceId: string | number): Promise<number> => {
  const res = await payload.find({
    collection: asSlug(variantSlug),
    where: { source: { equals: sourceId } },
    limit: 0,
    depth: 0,
  })
  return res.totalDocs
}

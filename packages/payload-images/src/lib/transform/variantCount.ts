/** Count the cached variants for one source — the per-image cap check on the generate path. */
import type { Payload } from 'payload'
import { asSlug } from '../asSlug'

export const countVariantsForSource = async (payload: Payload, variantSlug: string, sourceId: string | number): Promise<number> => {
  const res = await payload.find({
    collection: asSlug(variantSlug),
    where: { source: { equals: sourceId } },
    limit: 0, // count only — the indexed `source` field makes this cheap
    depth: 0,
    overrideAccess: true,
  })
  return res.totalDocs
}

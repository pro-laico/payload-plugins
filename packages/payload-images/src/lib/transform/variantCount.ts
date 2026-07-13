/** Count the cached variants for one source — the per-image cap check on the generate path. */
import type { CollectionSlug, Payload } from 'payload'

export const countVariantsForSource = async (payload: Payload, variantSlug: string, sourceId: string | number): Promise<number> => {
  const res = await payload.find({
    collection: variantSlug as CollectionSlug, //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
    where: { source: { equals: sourceId } },
    limit: 0, // count only — the indexed `source` field makes this cheap
    depth: 0,
    overrideAccess: true,
  })
  return res.totalDocs
}

/**
 * The shared variant-purge primitive: bulk-delete every generated variant of a source image.
 * Deleting a generated-image doc cascades its file removal through the storage adapter's own
 * hooks, so purging is just a delete by `source` — adapter-agnostic. Used by the source-collection
 * purge hooks (auto) and the purge endpoint (manual).
 */
import type { Payload, PayloadRequest } from 'payload'
import { asSlug } from '../../lib/asSlug'

/** Delete every generated variant of a source image; returns the count removed. Pass the calling
 *  hook's `req` so the bulk delete joins that operation's transaction. */
export const purgeVariantsForSource = async (
  payload: Payload,
  variantSlug: string,
  sourceId: string | number,
  req?: PayloadRequest,
): Promise<number> => {
  const res = await payload.delete({
    collection: asSlug(variantSlug),
    where: { source: { equals: sourceId } },
    overrideAccess: true,
    req,
  })
  if (res?.errors?.length)
    payload.logger.warn(`[payload-images] ${res.errors.length} generated variant(s) failed to purge for source ${sourceId}`)
  return res?.docs?.length ?? 0
}

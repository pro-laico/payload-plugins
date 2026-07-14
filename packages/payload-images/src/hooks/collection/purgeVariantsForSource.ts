import type { Payload, PayloadRequest } from 'payload'

import { asSlug } from '../../lib/asSlug'

export const purgeVariantsForSource = async (
  payload: Payload,
  variantSlug: string,
  sourceId: string | number,
  req?: PayloadRequest,
): Promise<number> => {
  const res = await payload.delete({
    collection: asSlug(variantSlug),
    where: { source: { equals: sourceId } },
    req,
  })
  if (res?.errors?.length)
    payload.logger.warn(`[payload-images] ${res.errors.length} generated variant(s) failed to purge for source ${sourceId}`)
  return res?.docs?.length ?? 0
}

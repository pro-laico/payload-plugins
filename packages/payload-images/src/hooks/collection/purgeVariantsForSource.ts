import type { Payload, PayloadRequest } from 'payload'

import { asSlug } from '../../_kit'

export const purgeVariantsForSource = async (
  payload: Payload,
  variantSlug: string,
  sourceId: string | number,
  req?: PayloadRequest,
): Promise<number> => {
  // Never join the caller's transaction: bulk deletes run this hook concurrently per doc on a
  // shared req, and concurrent transactions on one mongo session abort each other. Variants are a
  // disposable cache — a rolled-back source delete just regenerates them on demand.
  const res = await payload.delete({
    collection: asSlug(variantSlug),
    where: { source: { equals: sourceId } },
    req,
    disableTransaction: true,
  })
  if (res?.errors?.length)
    payload.logger.warn(`[payload-images] ${res.errors.length} generated variant(s) failed to purge for source ${sourceId}`)
  return res?.docs?.length ?? 0
}

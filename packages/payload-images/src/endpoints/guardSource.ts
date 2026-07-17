import type { PayloadRequest } from 'payload'

import { routeId } from './routeId'
import { asSlug } from '../_kit'

/**
 * Shared guard for the per-source admin endpoints (purge, prewarm, presets):
 * 401 unauthenticated → 400 missing id → 404 when the user can't read the source.
 * Returns the source doc so handlers that need it don't re-fetch.
 */
export const guardSourceRequest = async (req: PayloadRequest, sourceSlug: string): Promise<{ id: string; doc: unknown } | Response> => {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const id = routeId(req)
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  try {
    const doc: unknown = await req.payload.findByID({ collection: asSlug(sourceSlug), id, depth: 0, overrideAccess: false, user: req.user })
    return { id, doc }
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

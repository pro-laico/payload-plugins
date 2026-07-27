import type { PayloadRequest } from 'payload'

import { routeId } from './routeId'
import { asSlug, isAllowed, type EndpointAccess } from '../_kit'

/**
 * Shared guard for the per-source admin endpoints (purge, prewarm, presets): the `manage` gate
 * (default: any logged-in user) → 400 missing id → 404 when the user can't read the source.
 * Returns the source doc so handlers that need it don't re-fetch.
 */
export const guardSourceRequest = async (
  req: PayloadRequest,
  sourceSlug: string,
  gate?: EndpointAccess,
): Promise<{ id: string; doc: unknown } | Response> => {
  if (!(await isAllowed(gate, req))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const id = routeId(req)
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  try {
    const doc: unknown = await req.payload.findByID({ collection: asSlug(sourceSlug), id, depth: 0, overrideAccess: false, user: req.user })
    return { id, doc }
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

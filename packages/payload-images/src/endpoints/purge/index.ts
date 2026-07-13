import type { Endpoint, PayloadRequest } from 'payload'
import { asSlug } from '../../lib/asSlug'

import { routeId } from '../routeId'
import { purgeVariantsForSource } from '../../hooks/collection/purgeVariantsForSource'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import type { PurgeEndpointConfig } from '../../types'

/**
 * POST `/img/purge/:id` — delete all generated variants of a source image. Requires a logged-in
 * user who can READ that source, so a user can't purge (and force costly regeneration of)
 * variants for images they can't even see.
 */
export const createPurgeEndpoint = (cfg: PurgeEndpointConfig = {}): Endpoint => {
  const variantSlug = cfg.variantSlug || GENERATED_IMAGES_SLUG
  const sourceSlug = asSlug(cfg.sourceSlug || 'images')

  return {
    path: '/img/purge/:id',
    method: 'post',
    handler: async (req: PayloadRequest): Promise<Response> => {
      if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const id = routeId(req)
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

      try {
        await req.payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user: req.user })
      } catch {
        return Response.json({ error: 'Not found' }, { status: 404 })
      }

      try {
        const deleted = await purgeVariantsForSource(req.payload, variantSlug, id, req)
        return Response.json({ deleted })
      } catch (err) {
        req.payload.logger.error(`[payload-images] purge failed for ${id}: ${String(err)}`)
        return Response.json({ error: 'Purge failed' }, { status: 500 })
      }
    },
  }
}

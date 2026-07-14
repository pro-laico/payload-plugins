import type { Endpoint, PayloadRequest } from 'payload'

import { routeId } from '../routeId'
import { asSlug } from '../../lib/asSlug'
import type { PurgeEndpointConfig } from '../../types'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { purgeVariantsForSource } from '../../hooks/collection/purgeVariantsForSource'

export const createPurgeEndpoint = (cfg: PurgeEndpointConfig = {}): Endpoint => {
  const sourceSlug = asSlug(cfg.sourceSlug || 'images')
  const variantSlug = cfg.variantSlug || GENERATED_IMAGES_SLUG

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

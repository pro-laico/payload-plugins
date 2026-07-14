import type { Endpoint, PayloadRequest } from 'payload'

import { asSlug } from '../../lib/asSlug'
import { guardSourceRequest } from '../guardSource'
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
      const guarded = await guardSourceRequest(req, sourceSlug)
      if (guarded instanceof Response) return guarded
      const { id } = guarded

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

/**
 * The authed variant-purge endpoint. Config-level — registered by the plugin so it mounts
 * at `/api/img/purge/...` (see the routing note in ./transform.ts).
 */
import type { CollectionSlug, Endpoint, Payload, PayloadRequest } from 'payload'

import { GENERATED_IMAGES_SLUG } from '../collections/generatedImages'
import { purgeVariantsForSource } from '../hooks/purge'
import { routeId } from './routeId'

export interface PurgeEndpointConfig {
  /** Generated-images collection slug. Default `generated-images`. */
  variantSlug?: string
  /** Source image collection slug (purge is authorized against read access to it). Default `images`. */
  sourceSlug?: string
}

/**
 * POST `/img/purge/:id` — delete all generated variants of a source image. Requires a
 * logged-in user who can READ that source (so a user can't purge—and force costly
 * regeneration of—variants for images they can't even see).
 */
export const createPurgeEndpoint = (cfg: PurgeEndpointConfig = {}): Endpoint => {
  const path = '/img/purge'
  const variantSlug = cfg.variantSlug || GENERATED_IMAGES_SLUG
  const sourceSlug = (cfg.sourceSlug || 'images') as CollectionSlug

  return {
    path: `${path}/:id`,
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
        const deleted = await purgeVariantsForSource(req.payload as Payload, variantSlug, id, req)
        return Response.json({ deleted })
      } catch (err) {
        req.payload.logger.error(`[payload-images] purge failed for ${id}: ${String(err)}`)
        return Response.json({ error: 'Purge failed' }, { status: 500 })
      }
    },
  }
}

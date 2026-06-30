import type { Endpoint } from 'payload'
import { runSeed } from './engine/run'
import { SEED_DISABLED_MESSAGE, seedingEnabled } from './guard'
import type { ResolvedSeedOptions } from './options'

/**
 * Builds `POST /api/seed`. Gated by the `ENABLE_SEED` runtime guard and requires an
 * authenticated admin user. Each write sets `context.disableRevalidate`, so app revalidate
 * hooks skip during the run; the engine does no final revalidation.
 */
export function createSeedEndpoint(options: ResolvedSeedOptions): Endpoint {
  return {
    path: '/seed',
    method: 'post',
    handler: async (req) => {
      if (!seedingEnabled()) return Response.json({ error: SEED_DISABLED_MESSAGE }, { status: 403 })
      if (!req.user) return Response.json({ error: 'Action forbidden.' }, { status: 403 })

      try {
        const result = await runSeed({ payload: req.payload, req, options, definitions: options.definitions })
        return Response.json({ success: true, ...result })
      } catch (e) {
        req.payload.logger.error({ err: e, msg: 'Error seeding data' })
        return Response.json({ error: 'Error seeding data.' }, { status: 500 })
      }
    },
  }
}

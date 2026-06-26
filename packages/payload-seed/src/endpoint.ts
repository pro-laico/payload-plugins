import type { Endpoint } from 'payload'
import { runSeed } from './engine/run'
import { SEED_DISABLED_MESSAGE, seedingEnabled } from './guard'
import type { ResolvedSeedOptions } from './options'

/**
 * Builds the `POST /seed` endpoint (resolves to `POST /api/seed`). Gated by the
 * `ENABLE_SEED` runtime guard and the configured `authorize` predicate (default: any
 * authenticated user). Runs inside Next, so the engine's final revalidation takes effect.
 */
export function createSeedEndpoint(options: ResolvedSeedOptions): Endpoint {
  return {
    path: options.endpoint,
    method: 'post',
    handler: async (req) => {
      if (!seedingEnabled()) return Response.json({ error: SEED_DISABLED_MESSAGE }, { status: 403 })
      if (!req.user) return Response.json({ error: 'Action forbidden.' }, { status: 403 })
      if (options.authorize && !(await options.authorize(req.user))) return Response.json({ error: 'Action forbidden.' }, { status: 403 })

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

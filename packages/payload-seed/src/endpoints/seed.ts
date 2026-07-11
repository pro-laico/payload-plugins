import type { Endpoint } from 'payload'
import { runSeed } from '../engine/run'
import { SeedRunError, SeedValidationError } from '../engine/validate'
import { SEED_DISABLED_MESSAGE, seedingEnabled } from '../guard'
import type { ResolvedSeedOptions } from '../types'

/**
 * Builds `POST /api/seed`. Gated by the `ENABLE_SEED` runtime guard and requires an
 * authenticated user (any user — not necessarily an admin). Each write sets
 * `context.disableRevalidate`, so app revalidate hooks skip during the run; the engine
 * does no final revalidation.
 */
export function createSeedEndpoint(options: ResolvedSeedOptions): Endpoint {
  return {
    path: '/seed',
    method: 'post',
    handler: async (req) => {
      if (!seedingEnabled()) return Response.json({ error: SEED_DISABLED_MESSAGE }, { status: 403 })
      if (!req.user)
        return Response.json({ error: 'Seeding requires an authenticated Payload user (any user) - log in first.' }, { status: 403 })

      try {
        const result = await runSeed({ payload: req.payload, req, options, definitions: options.definitions })
        const message = options.definitions?.length ? undefined : '0 documents created — no seed definitions registered'
        return Response.json({ success: true, ...(message ? { message } : {}), ...result })
      } catch (e) {
        req.payload.logger.error({ err: e, msg: 'Error seeding data' })
        if (e instanceof SeedValidationError) return Response.json({ error: 'Seed validation failed.', issues: e.issues }, { status: 400 })
        if (e instanceof SeedRunError) return Response.json({ error: 'Error seeding data.', issues: [e.detail] }, { status: 500 })
        return Response.json({ error: 'Error seeding data.' }, { status: 500 })
      }
    },
  }
}

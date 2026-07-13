import type { Endpoint, PayloadRequest } from 'payload'

import { bust } from '../lib/bust'
import { getInspection } from '../lib/inspect'

export const MAP_ENDPOINT_PATH = '/revalidate-map'

/**
 * The dependency-map endpoints, dev-gated like payload-dev-tools' endpoints (404 unless
 * observation is on — which defaults to `NODE_ENV === 'development'`):
 *
 * - `GET /api/revalidate-map` — `{ graph, prefix, observing, rules, reads, events }`:
 *   the static "what CAN revalidate what" graph plus everything observed at runtime.
 * - `POST /api/revalidate-map` `{ "tag": "posts:42" }` — bust one tag by hand; powers the
 *   dev view's "bust this" button and integration tests. Recorded as a `manual` event.
 *
 * When `observe` is forced on in production, both methods additionally require an
 * authenticated Payload user: GET discloses the full schema graph and observed reads,
 * POST expires arbitrary cache tags — neither may be anonymous outside dev.
 */
export function createMapEndpoints({ observe }: { observe: boolean }): Endpoint[] {
  const gate = (req: PayloadRequest): Response | null => {
    if (!observe) return Response.json({ error: 'Not found' }, { status: 404 })
    if (process.env.NODE_ENV === 'production' && !req.user) return Response.json({ error: 'Not found' }, { status: 404 })
    return null
  }

  return [
    {
      path: MAP_ENDPOINT_PATH,
      method: 'get',
      handler: async (req) => {
        const blocked = gate(req)
        if (blocked) return blocked
        const inspection = getInspection()
        if (!inspection) return Response.json({ error: 'payload-revalidate is not active in this process' }, { status: 503 })
        return Response.json(inspection)
      },
    },
    {
      path: MAP_ENDPOINT_PATH,
      method: 'post',
      handler: async (req) => {
        const blocked = gate(req)
        if (blocked) return blocked
        const body = req.json ? await req.json().catch(() => null) : null
        const tag = typeof (body as { tag?: unknown } | null)?.tag === 'string' ? (body as { tag: string }).tag : null
        if (!tag) return Response.json({ error: 'Body must be JSON: { "tag": "..." }' }, { status: 400 })
        await bust([{ tag, reason: 'manual' }], { slug: tag, operation: 'manual', lane: 'published' }, 'manual', observe)
        return Response.json({ busted: tag })
      },
    },
  ]
}

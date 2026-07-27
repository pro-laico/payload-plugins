import type { Endpoint } from 'payload'

import { bust } from '../lib/bust'
import { getInspection } from '../lib/inspect'
import { type EndpointAccess, isAllowed, isRecord } from '../_kit'

export const MAP_ENDPOINT_PATH = '/revalidate-map'

// The default gate: open in dev, and in production require a logged-in user (else 404, to hide existence).
const defaultInspectGate: EndpointAccess = (req) => process.env.NODE_ENV !== 'production' || Boolean(req.user)

// Only registered when `observe` is on (see plugin.ts). `inspect` is the consumer's override, if any.
export function createMapEndpoints(inspect: EndpointAccess | undefined): Endpoint[] {
  return [
    {
      path: MAP_ENDPOINT_PATH,
      method: 'get',
      handler: async (req) => {
        if (!(await isAllowed(inspect, req, defaultInspectGate))) return Response.json({ error: 'Not found' }, { status: 404 })
        const inspection = getInspection()
        if (!inspection) return Response.json({ error: 'payload-revalidate is not active in this process' }, { status: 503 })
        return Response.json(inspection)
      },
    },
    {
      path: MAP_ENDPOINT_PATH,
      method: 'post',
      handler: async (req) => {
        if (!(await isAllowed(inspect, req, defaultInspectGate))) return Response.json({ error: 'Not found' }, { status: 404 })
        const body: unknown = req.json ? await req.json().catch(() => null) : null
        const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : null
        if (!tag) return Response.json({ error: 'Body must be JSON: { "tag": "..." }' }, { status: 400 })
        await bust([{ tag, reason: 'manual' }], { slug: tag, operation: 'manual', lane: 'published' }, 'manual', true)
        return Response.json({ busted: tag })
      },
    },
  ]
}

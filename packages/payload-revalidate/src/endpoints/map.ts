import type { Endpoint, PayloadRequest } from 'payload'

import { bust } from '../lib/bust'
import { isRecord } from '../_kit'
import { getInspection } from '../lib/inspect'

export const MAP_ENDPOINT_PATH = '/revalidate-map'

// Only registered when `observe` is on (see plugin.ts), so the gate here is purely the prod auth check.
export function createMapEndpoints(): Endpoint[] {
  const gate = (req: PayloadRequest): Response | null =>
    process.env.NODE_ENV === 'production' && !req.user ? Response.json({ error: 'Not found' }, { status: 404 }) : null

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
        const body: unknown = req.json ? await req.json().catch(() => null) : null
        const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : null
        if (!tag) return Response.json({ error: 'Body must be JSON: { "tag": "..." }' }, { status: 400 })
        await bust([{ tag, reason: 'manual' }], { slug: tag, operation: 'manual', lane: 'published' }, 'manual', true)
        return Response.json({ busted: tag })
      },
    },
  ]
}

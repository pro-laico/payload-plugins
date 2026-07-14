import type { Endpoint, PayloadRequest } from 'payload'

import { bust } from '../lib/bust'
import { getInspection } from '../lib/inspect'

export const MAP_ENDPOINT_PATH = '/revalidate-map'

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
        //TODO: replace `as` casts with proper typing
        const tag = typeof (body as { tag?: unknown } | null)?.tag === 'string' ? (body as { tag: string }).tag : null
        if (!tag) return Response.json({ error: 'Body must be JSON: { "tag": "..." }' }, { status: 400 })
        await bust([{ tag, reason: 'manual' }], { slug: tag, operation: 'manual', lane: 'published' }, 'manual', observe)
        return Response.json({ busted: tag })
      },
    },
  ]
}

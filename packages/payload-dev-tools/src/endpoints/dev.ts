import type { Endpoint } from 'payload'

import { buildDevSnapshot } from '../lib/snapshot'

export function createDevEndpoint({ devRoute }: { devRoute: string }): Endpoint {
  return {
    path: '/dev',
    method: 'get',
    handler: async (req) => {
      const url = new URL(req.url ?? '/api/dev', 'http://localhost')
      const wantsHtml = url.searchParams.get('format') !== 'json' && (req.headers.get('accept') ?? '').includes('text/html')
      if (wantsHtml) return new Response(null, { status: 307, headers: { location: devRoute } })

      return Response.json(await buildDevSnapshot(req.payload))
    },
  }
}

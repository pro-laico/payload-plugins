import type { Endpoint } from 'payload'

import { devToolsEnabled } from '../options'
import { buildDevSnapshot } from '../lib/snapshot'

export function createDevEndpoint({ enabled, devRoute }: { enabled?: boolean; devRoute: string }): Endpoint {
  return {
    path: '/dev',
    method: 'get',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      const url = new URL(req.url ?? '/api/dev', 'http://localhost')
      const wantsHtml = url.searchParams.get('format') !== 'json' && (req.headers.get('accept') ?? '').includes('text/html')
      if (wantsHtml) return new Response(null, { status: 307, headers: { location: devRoute } })

      return Response.json(await buildDevSnapshot(req.payload))
    },
  }
}

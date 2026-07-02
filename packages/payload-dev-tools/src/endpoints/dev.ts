import type { Endpoint } from 'payload'
import { buildDevSnapshot } from '../lib/snapshot'
import { devToolsEnabled } from '../options'

/**
 * `GET /api/dev` — the machine-readable snapshot (see {@link buildDevSnapshot}) for `fetch`,
 * `curl`, and AI agents. A browser asking for HTML is redirected to the dev pages (`devRoute`,
 * where the host mounts `createDevPage`) — the human view lives there, inside the app;
 * `?format=json` skips the redirect. Outside dev it 404s (see {@link devToolsEnabled}).
 */
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

import type { Endpoint } from 'payload'

import { isAllowed, publicRequest } from '../_kit'
import { buildDevSnapshot } from '../lib/snapshot'
import type { ResolvedDevToolsOptions } from '../types'

export function createDevEndpoint({ devRoute, access }: { devRoute: string; access?: ResolvedDevToolsOptions['options']['access'] }): Endpoint {
  return {
    path: '/dev',
    method: 'get',
    handler: async (req) => {
      if (!(await isAllowed(access?.dev, req, publicRequest))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

      const url = new URL(req.url ?? '/api/dev', 'http://localhost')
      const wantsHtml = url.searchParams.get('format') !== 'json' && (req.headers.get('accept') ?? '').includes('text/html')
      if (wantsHtml) return new Response(null, { status: 307, headers: { location: devRoute } })

      return Response.json(await buildDevSnapshot(req.payload))
    },
  }
}

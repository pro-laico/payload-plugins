import type { Endpoint } from 'payload'

import { regionFor } from '../lib/regions'
import { REGION_COOKIE } from '../cookies'
import { isAllowed, publicRequest } from '../_kit'
import type { DevRegion, ResolvedDevToolsOptions } from '../types'

/** `GET /api/dev/region?code=DE` — the scriptable half of the toolbar's Region toggle, for
 * Playwright runs that need to visit the site as a German visitor. `?clear=1` (or no code) goes
 * back to the real location. */
export function createRegionEndpoint({
  regions,
  access,
}: {
  regions: DevRegion[]
  access?: ResolvedDevToolsOptions['options']['access']
}): Endpoint {
  return {
    path: '/dev/region',
    method: 'get',
    handler: async (req) => {
      if (!(await isAllowed(access?.dev, req, publicRequest))) return Response.json({ error: 'Forbidden.' }, { status: 403 })

      const url = new URL(req.url ?? '/api/dev/region', 'http://localhost')
      const code = url.searchParams.get('code')
      const clearing = url.searchParams.get('clear') !== null || !code

      const region = clearing ? undefined : regionFor(code, regions)
      if (!clearing && !region) return Response.json({ error: `Unknown region '${code}'.` }, { status: 400 })

      const rawTo = url.searchParams.get('to') ?? '/'
      const to = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/'
      const cookie = region ? `${REGION_COOKIE}=${region.code}; Path=/; SameSite=Lax` : `${REGION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`

      return new Response(null, { status: 303, headers: { location: to, 'set-cookie': cookie } })
    },
  }
}

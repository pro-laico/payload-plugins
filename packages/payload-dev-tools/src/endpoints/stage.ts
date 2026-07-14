import type { Endpoint } from 'payload'

import { devToolsEnabled } from '../options'
import { CHROME_COOKIES, STAGE_COOKIE } from '../cookies'

export function createStageEndpoint({ enabled, devRoute }: { enabled?: boolean; devRoute: string }): Endpoint {
  return {
    path: '/dev/stage',
    method: 'get',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      const url = new URL(req.url ?? '/api/dev/stage', 'http://localhost')
      const test = url.searchParams.get('test')
      const slotParam = url.searchParams.get('slot')
      const version = url.searchParams.get('version')
      const slot = slotParam === 'header' || slotParam === 'footer' ? slotParam : null
      const cookieName = slot ? CHROME_COOKIES[slot] : STAGE_COOKIE
      const clearing = url.searchParams.get('clear') !== null || !test || !version

      const rawTo = url.searchParams.get('to') ?? (clearing || slot ? '/' : `${devRoute}/tests/${test}`)
      const to = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/'

      const cookie = clearing
        ? `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`
        : `${cookieName}=${encodeURIComponent(`${test}:${version}`)}; Path=/; SameSite=Lax`

      return new Response(null, { status: 303, headers: { location: to, 'set-cookie': cookie } })
    },
  }
}

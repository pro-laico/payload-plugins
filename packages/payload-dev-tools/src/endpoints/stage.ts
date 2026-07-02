import type { Endpoint } from 'payload'
import { CHROME_COOKIES, STAGE_COOKIE } from '../cookies'
import { devToolsEnabled } from '../options'

/**
 * `GET /api/dev/stage?test=<key>&version=<id>` — URL-addressable version selection. Sets the
 * selection cookie and redirects to the test's page (`<devRoute>/tests/<key>`, or `to` when
 * given), which renders that version. `?slot=header|footer` targets a chrome-override cookie
 * instead (redirecting to `/` — the override applies site-wide via `resolveDevChrome`).
 * `?clear=1` clears the targeted cookie. Exists so a screenshot script or an AI agent can put a
 * specific version on screen by navigating to one URL instead of driving the toolbar UI.
 */
export function createStageEndpoint({ enabled, devRoute }: { enabled?: boolean; devRoute: string }): Endpoint {
  return {
    path: '/dev/stage',
    method: 'get',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      const url = new URL(req.url ?? '/api/dev/stage', 'http://localhost')
      const test = url.searchParams.get('test')
      const version = url.searchParams.get('version')
      const slotParam = url.searchParams.get('slot')
      const slot = slotParam === 'header' || slotParam === 'footer' ? slotParam : null
      const cookieName = slot ? CHROME_COOKIES[slot] : STAGE_COOKIE
      const clearing = url.searchParams.get('clear') !== null || !test || !version

      const rawTo = url.searchParams.get('to') ?? (clearing || slot ? '/' : `${devRoute}/tests/${test}`)
      // Same-site paths only — no open redirect, even in dev.
      const to = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/'

      const cookie = clearing
        ? `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`
        : `${cookieName}=${encodeURIComponent(`${test}:${version}`)}; Path=/; SameSite=Lax`

      return new Response(null, { status: 303, headers: { location: to, 'set-cookie': cookie } })
    },
  }
}

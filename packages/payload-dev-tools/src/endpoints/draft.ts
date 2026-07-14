import type { Endpoint } from 'payload'

import { devToolsEnabled } from '../options'

const TRUTHY = new Set(['1', 'true', 'on'])
const FALSY = new Set(['0', 'false', 'off'])

export function createDraftEndpoint(enabled?: boolean): Endpoint {
  return {
    path: '/dev/draft',
    method: 'get',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      let draft: { isEnabled: boolean; enable: () => void; disable: () => void }
      try {
        const { draftMode } = await import('next/headers')
        draft = await draftMode()
      } catch {
        return Response.json({ error: 'Draft mode needs a Next.js request context.' }, { status: 503 })
      }

      const url = new URL(req.url ?? '/api/dev/draft', 'http://localhost')
      const param = url.searchParams.get('enable')?.toLowerCase() ?? null
      if (param !== null && TRUTHY.has(param)) draft.enable()
      else if (param !== null && FALSY.has(param)) draft.disable()
      else if (param !== null) return Response.json({ error: `Unrecognized enable value "${param}" — use 1/0.` }, { status: 400 })

      const rawTo = url.searchParams.get('to')
      if (rawTo)
        return new Response(null, { status: 303, headers: { location: rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/' } })

      const enabledNow = param === null ? draft.isEnabled : TRUTHY.has(param)
      return Response.json({ enabled: enabledNow })
    },
  }
}

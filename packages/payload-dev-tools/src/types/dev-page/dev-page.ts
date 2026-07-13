import type { Payload } from 'payload'

import type { Test } from '../harness/harness'

export type CreateDevPageOptions = {
  /** Your app's live Payload session — `createDevPage({ payload: getPayload({ config }) })`.
   *  The `getPayload` promise is welcome as-is; only the page render awaits it. */
  payload: Payload | Promise<Payload>
  /** Component tests (from `defineTest`) — each gets ONE page at `/dev/tests/<key>`; which
   *  version it shows is controlled from the dev toolbar (via the selection cookie). Pass the
   *  same array to `<DevToolbar tests>`. */
  tests?: Test[]
  /** Force the pages on/off. Defaults to `NODE_ENV === 'development'` (404 otherwise). */
  enabled?: boolean
}

export type DevPageProps = { params: Promise<{ view?: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }

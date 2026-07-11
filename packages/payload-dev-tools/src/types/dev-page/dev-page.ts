import type { Test } from '../harness/harness'

export type CreateDevPageOptions = {
  /** Component tests (from `defineTest`) — each gets ONE page at `/dev/tests/<key>`; which
   *  version it shows is controlled from the dev toolbar (via the selection cookie). Pass the
   *  same array to `<DevToolbar tests>`. */
  tests?: Test[]
  /** Force the pages on/off. Defaults to `NODE_ENV === 'development'` (404 otherwise). */
  enabled?: boolean
}

export type DevPageProps = { params: Promise<{ view?: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }

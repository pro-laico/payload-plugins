import type { Test } from '../harness/harness'

export type DevLink = { href: string; title: string }

export type DevToolbarProps = {
  /** Component tests (from `defineTest`) — the Tests view opens each test's page
   *  (`/dev/tests/<key>`) and toggles which version it shows. Render fns stay server-side; the
   *  client only sees labels. */
  tests?: Test[]
  /** Extra rows for the Pages view (your own labs, external dashboards…) — the dev pages and the
   *  admin are built in. */
  links?: DevLink[]
  /** Force the toolbar on/off. Defaults to `NODE_ENV === 'development'` — it renders nothing in
   *  production, so no conditional is needed at the call site. */
  enabled?: boolean
}

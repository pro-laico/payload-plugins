import { Suspense } from 'react'
import { type Test, toTestMeta } from '../harness'
import { type DevLink, DevToolbarClient } from './DevToolbarClient'
import { PDT_CSS } from './styles'

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

/**
 * The floating dev toolbar — the one controller for the dev experience, one line of wiring:
 *
 *   <DevToolbar />                       // in your (frontend) layout, inside <body>
 *   <DevToolbar tests={[heroTest]} />    // optionally, with the test harness
 *
 * It injects its own stylesheet (no Tailwind, no CSS import) and feeds itself from
 * `GET /api/dev`. Because it lives in the layout, the panel survives client-side navigation —
 * browse `/dev` → icons → fonts → tests without it closing. The dev pages themselves render
 * content only; navigation and version-switching live here.
 */
export function DevToolbar({ tests = [], links = [], enabled }: DevToolbarProps) {
  if (!(enabled ?? process.env.NODE_ENV === 'development')) return null

  return (
    <>
      {/* dangerouslySetInnerHTML: our own static CSS — React would escape selector characters as a text child */}
      <style dangerouslySetInnerHTML={{ __html: PDT_CSS }} />
      {/* Suspense: the client panel reads the pathname (request-bound), which under Cache
          Components (cacheComponents: true) must stream inside a boundary — without it every
          page hosting the toolbar errors as a blocking route. */}
      <Suspense fallback={null}>
        <DevToolbarClient tests={toTestMeta(tests)} links={links} />
      </Suspense>
    </>
  )
}

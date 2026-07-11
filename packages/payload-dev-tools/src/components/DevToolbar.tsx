import { Suspense } from 'react'
import { toTestMeta } from '../harness'
import type { DevToolbarProps } from '../types'
import { DevToolbarClient } from './DevToolbarClient'
import { PDT_CSS } from './styles'

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

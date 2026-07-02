import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { STAGE_COOKIE } from '../cookies'
import { parseStage, type Test } from '../harness'
import { getPayloadClient } from '../lib/getPayloadClient'
import { buildDevSnapshot, type DevSnapshot } from '../lib/snapshot'
import { SeedCard } from './client'
import { PDTP_CSS } from './pageStyles'
import { FontsView, IconsView, ImagesView, MuxView } from './views'

export type CreateDevPageOptions = {
  /** Component tests (from `defineTest`) — each gets ONE page at `/dev/tests/<key>`; which
   *  version it shows is controlled from the dev toolbar (via the selection cookie). Pass the
   *  same array to `<DevToolbar tests>`. */
  tests?: Test[]
  /** Force the pages on/off. Defaults to `NODE_ENV === 'development'` (404 otherwise). */
  enabled?: boolean
}

type DevPageProps = { params: Promise<{ view?: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }

/**
 * The `/dev` pages — real routes inside your app, one drop-in file:
 *
 *   // app/(frontend)/dev/[[...view]]/page.tsx
 *   import { createDevPage } from '@pro-laico/payload-dev-tools/next'
 *   import { devTests } from '@/dev/tests'
 *   export const dynamic = 'force-dynamic'
 *   export default createDevPage({ tests: devTests })
 *
 * Views: `/dev` (overview + seed controls), `/dev/icons` (grid + active-set switcher),
 * `/dev/fonts` (specimens in the real served fonts), `/dev/images`, `/dev/mux`, and
 * `/dev/tests/<key>` (one page per test; the shown version is toggled from the toolbar). The
 * pages render content only — navigation lives in the `<DevToolbar>`, which stays open while you
 * browse between them. Because the file lives in your `(frontend)` group, everything inherits
 * your layout — header, fonts, globals — which is the point: visual confirmation happens in the
 * app, not a facsimile of it. The component resolves Payload itself (config stash → the
 * `@payload-config` alias), so it takes no config prop. Your own labs coexist: a static route
 * like `app/(frontend)/dev/blocks/page.tsx` always beats this catch-all.
 */
export function createDevPage(options: CreateDevPageOptions = {}) {
  const { tests = [], enabled } = options

  return async function DevPage({ params, searchParams }: DevPageProps) {
    if (!(enabled ?? process.env.NODE_ENV === 'development')) notFound()

    const { view = [] } = await params
    const query = (await searchParams) ?? {}
    const payload = await getPayloadClient()
    const snapshot = await buildDevSnapshot(payload)

    const [section, ...rest] = view
    switch (section) {
      case undefined:
        return (
          <Shell snapshot={snapshot} title={snapshot.devRoute}>
            <DevIndex snapshot={snapshot} />
          </Shell>
        )
      case 'icons':
        if (!snapshot.icons || rest.length) notFound()
        return (
          <Shell snapshot={snapshot} title="Icons">
            <IconsView payload={payload} snapshot={snapshot} />
          </Shell>
        )
      case 'fonts':
        if (!snapshot.fonts || rest.length) notFound()
        return (
          <Shell snapshot={snapshot} title="Fonts">
            <FontsView payload={payload} snapshot={snapshot} />
          </Shell>
        )
      case 'images':
        if (!snapshot.images || rest.length) notFound()
        return (
          <Shell snapshot={snapshot} title="Images">
            <ImagesView payload={payload} snapshot={snapshot} searchParams={query} />
          </Shell>
        )
      case 'mux':
        if (!snapshot.mux || rest.length) notFound()
        return (
          <Shell snapshot={snapshot} title="Mux">
            <MuxView payload={payload} snapshot={snapshot} />
          </Shell>
        )
      case 'tests': {
        if (!tests.length || rest.length > 1) notFound()
        if (rest.length === 1) return <TestPage tests={tests} testKey={rest[0] ?? ''} />
        return (
          <Shell snapshot={snapshot} title="Tests">
            <TestsIndex tests={tests} />
          </Shell>
        )
      }
      default:
        notFound()
    }
  }
}

/** Content chrome only — heading + env line. Navigation is the toolbar's job. */
const Shell = ({ snapshot, title, children }: { snapshot: DevSnapshot; title: string; children: ReactNode }) => (
  <div className="pdtp">
    {/* dangerouslySetInnerHTML: our own static CSS — React would escape selector characters as a text child */}
    <style dangerouslySetInnerHTML={{ __html: PDTP_CSS }} />
    <div className="pdtp-container">
      <div className="pdtp-head">
        <h1>{title}</h1>
        <span className="pdtp-badge">dev only</span>
        <span className="pdtp-env">
          {snapshot.env.nodeEnv} · node {snapshot.env.nodeVersion} · navigate via the dev toolbar ↘
        </span>
      </div>
      {children}
    </div>
  </div>
)

const DevIndex = ({ snapshot }: { snapshot: DevSnapshot }) => (
  <>
    <div className="pdtp-chips">
      {Object.entries(snapshot.plugins).map(([name, on]) => (
        <span key={name}>
          <span className={`pdtp-dot ${on ? 'pdtp-dot-on' : 'pdtp-dot-off'}`} />
          payload-{name}
        </span>
      ))}
    </div>

    <div className="pdtp-section">
      <div className="pdtp-grid">
        {snapshot.seed ? <SeedCard seed={snapshot.seed} adminRoute={snapshot.adminRoute} /> : null}
        <div className="pdtp-card">
          <h2>
            Collections <span className="pdtp-kind">docs</span>
          </h2>
          <table className="pdtp-table">
            <tbody>
              {snapshot.collections.map((c) => (
                <tr key={c.slug}>
                  <td>{c.slug}</td>
                  <td className="pdtp-mono">{c.count ?? '?'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <p className="pdtp-note">
      Machine-readable: <span className="pdtp-code">GET /api/dev</span> serves this as JSON (browsers land here instead).
    </p>
  </>
)

const TestsIndex = ({ tests }: { tests: Test[] }) => (
  <>
    <table className="pdtp-table">
      <thead>
        <tr>
          <th>test</th>
          <th>kind</th>
          <th>versions</th>
        </tr>
      </thead>
      <tbody>
        {tests.map((t) => (
          <tr key={t.key}>
            <td>{t.label}</td>
            <td className="pdtp-mono">{t.kind}</td>
            <td className="pdtp-mono">{t.versions.map((v) => v.label).join(' · ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="pdtp-note">
      Each test is one page — open it (and toggle versions) from the toolbar's Tests view, or script it via{' '}
      <span className="pdtp-code">/api/dev/stage?test=…&version=…</span>
    </p>
  </>
)

/** One page per test. The shown version comes from the toolbar's selection cookie (defaulting to
 *  the first version) and renders inside your real frontend layout with NO extra chrome — the
 *  toolbar's Tests view names what you're looking at. The `display: contents` wrapper is
 *  layout-invisible; it exists only so screenshot tooling can assert `data-pdt-test` /
 *  `data-pdt-version`. */
const TestPage = async ({ tests, testKey }: { tests: Test[]; testKey: string }) => {
  const test = tests.find((t) => t.key === testKey)
  if (!test) notFound()

  const jar = await cookies()
  const stage = parseStage(jar.get(STAGE_COOKIE)?.value, tests)
  const version = (stage?.test.key === test.key ? stage.version : undefined) ?? test.versions[0]
  if (!version) notFound()

  return (
    <div style={{ display: 'contents' }} data-pdt-test={test.key} data-pdt-version={version.id}>
      {await version.render()}
    </div>
  )
}

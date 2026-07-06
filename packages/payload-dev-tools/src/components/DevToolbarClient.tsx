'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CHROME_COOKIES, type ChromeSlot, STAGE_COOKIE } from '../cookies'
import type { TestMeta } from '../harness'
import type { DevSnapshot } from '../lib/snapshot'

export type DevLink = { href: string; title: string }

type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
type Size = 'sm' | 'md' | 'lg'
type Settings = { corner: Corner; size: Size }
type View = 'main' | 'info' | 'seed' | 'pages' | 'tests' | 'settings'
type SeedError = { error: string; issues?: string[] }
type StageSelection = { testKey: string; versionId: string }

const STORE_KEY = 'pdt-settings'
const HIDE_KEY = 'pdt-hidden'
const DEFAULTS: Settings = { corner: 'bottom-right', size: 'md' }
const CORNER_CLASS: Record<Corner, string> = { 'bottom-right': 'br', 'bottom-left': 'bl', 'top-right': 'tr', 'top-left': 'tl' }
const CORNERS: { value: Corner; arrow: string }[] = [
  { value: 'top-left', arrow: '↖' },
  { value: 'top-right', arrow: '↗' },
  { value: 'bottom-left', arrow: '↙' },
  { value: 'bottom-right', arrow: '↘' },
]
const SIZES: Size[] = ['sm', 'md', 'lg']
const VIEW_TITLE: Record<Exclude<View, 'main'>, string> = { info: 'Info', seed: 'Seed', pages: 'Pages', tests: 'Tests', settings: 'Settings' }

const readSettings = (): Settings => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? { ...DEFAULTS, ...parsed } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

/** A selection cookie (`testKey:versionId`), read client-side — the server reads the same cookie
 *  (test pages for the stage cookie, `resolveDevChrome` for the chrome slots), so the toolbar
 *  chips and the rendered result always agree. */
const readSelectionCookie = (name: string): StageSelection | null => {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1]
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    const sep = decoded.indexOf(':')
    return sep > 0 ? { testKey: decoded.slice(0, sep), versionId: decoded.slice(sep + 1) } : null
  } catch {
    return null
  }
}

/**
 * The toolbar panel — THE controller for the dev experience. Navigation happens through it (the
 * dev pages render content only, no nav of their own), the panel stays open across route changes
 * (it lives in the layout, and rows are client-side `<Link>`s), and the Tests view both opens a
 * test's page and toggles which version that page shows.
 */
export function DevToolbarClient({ tests, links }: { tests: TestMeta[]; links: DevLink[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('main')
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [selection, setSelection] = useState<StageSelection | null>(null)
  const [chrome, setChrome] = useState<Record<ChromeSlot, StageSelection | null>>({ header: null, footer: null })
  const [snapshot, setSnapshot] = useState<DevSnapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState(false)
  const [draft, setDraft] = useState<boolean | null>(null)
  const [draftBusy, setDraftBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [seedError, setSeedError] = useState<SeedError | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHidden(sessionStorage.getItem(HIDE_KEY) === '1')
    setSettings(readSettings())
    setSelection(readSelectionCookie(STAGE_COOKIE))
    setChrome({ header: readSelectionCookie(CHROME_COOKIES.header), footer: readSelectionCookie(CHROME_COOKIES.footer) })
    setMounted(true)
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/dev', { headers: { accept: 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(String(res.status))
      setSnapshot((await res.json()) as DevSnapshot)
      setSnapshotError(false)
    } catch {
      setSnapshotError(true)
    }
  }, [])

  // Lazy: the snapshot loads on first open, not on page load.
  useEffect(() => {
    if (open && !snapshot && !snapshotError) void fetchSnapshot()
  }, [open, snapshot, snapshotError, fetchSnapshot])

  // Draft mode is server-held state (`__prerender_bypass` is httpOnly), so re-read it on every
  // open — a preview route or another tab may have flipped it. null = endpoint unavailable, row hidden.
  useEffect(() => {
    if (!open) return
    void fetch('/api/dev/draft', { credentials: 'include' })
      .then(async (res) => (res.ok ? setDraft(((await res.json()) as { enabled: boolean }).enabled) : setDraft(null)))
      .catch(() => setDraft(null))
  }, [open])

  const toggleDraft = useCallback(async () => {
    if (draft === null || draftBusy) return
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/dev/draft?enable=${draft ? 0 : 1}`, { credentials: 'include' })
      if (!res.ok) throw new Error(String(res.status))
      setDraft(((await res.json()) as { enabled: boolean }).enabled)
      router.refresh()
    } catch {
      setDraft(null)
    } finally {
      setDraftBusy(false)
    }
  }, [draft, draftBusy, router])

  const base = snapshot?.devRoute ?? '/dev'

  /** Select a version: write the cookie, then show it — refresh if we're already on the test's
   *  page, navigate there if not. The panel stays open either way. */
  const selectVersion = useCallback(
    (testKey: string, versionId: string) => {
      // biome-ignore lint/suspicious/noDocumentCookie: dev-only synchronous cookie write; Cookie Store API is async and not universal
      document.cookie = `${STAGE_COOKIE}=${encodeURIComponent(`${testKey}:${versionId}`)}; path=/; samesite=lax`
      setSelection({ testKey, versionId })
      const testPath = `${base}/tests/${testKey}`
      if (pathname === testPath) router.refresh()
      else router.push(testPath)
    },
    [base, pathname, router],
  )

  /** Set/clear a chrome override (header/footer swap): the cookie applies SITE-WIDE in dev —
   *  `resolveDevChrome` in the host layout swaps the variant in wherever you browse. */
  const selectChrome = useCallback(
    (slot: ChromeSlot, sel: StageSelection | null) => {
      // biome-ignore lint/suspicious/noDocumentCookie: dev-only synchronous cookie write; Cookie Store API is async and not universal
      document.cookie = sel
        ? `${CHROME_COOKIES[slot]}=${encodeURIComponent(`${sel.testKey}:${sel.versionId}`)}; path=/; samesite=lax`
        : `${CHROME_COOKIES[slot]}=; path=/; max-age=0; samesite=lax`
      setChrome((prev) => ({ ...prev, [slot]: sel }))
      router.refresh()
    },
    [router],
  )

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const runSeed = async () => {
    setSeeding(true)
    setSeedError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setConfirming(false)
        setSeeding(false)
        await fetchSnapshot()
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as SeedError | null
      setSeedError(body?.error ? body : { error: `Seed failed (HTTP ${res.status}).` })
    } catch {
      setSeedError({ error: 'Seed request failed — is the dev server running?' })
    }
    setSeeding(false)
    setConfirming(false)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !open) return
      if (view === 'main') setOpen(false)
      else setView('main')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, view])

  if (!mounted || hidden) return null

  const corner = CORNER_CLASS[settings.corner]
  const seed = snapshot?.seed

  const pageLinks: DevLink[] = [
    { href: base, title: 'Overview' },
    ...(snapshot?.icons ? [{ href: `${base}/icons`, title: 'Icons' }] : []),
    ...(snapshot?.fonts ? [{ href: `${base}/fonts`, title: 'Fonts' }] : []),
    ...(snapshot?.images ? [{ href: `${base}/images`, title: 'Images' }] : []),
    ...(snapshot?.mux ? [{ href: `${base}/mux`, title: 'Mux' }] : []),
    ...links,
    { href: snapshot?.adminRoute ?? '/admin', title: 'Payload admin' },
    { href: 'https://payload-plugins.prolaico.com/docs', title: 'Plugin docs ↗' },
  ]

  return (
    <div ref={rootRef} className={`pdt-root pdt-corner-${corner}`}>
      {open ? (
        <div className={`pdt-panel pdt-panel-${corner}`}>
          <div className="pdt-head">
            {view !== 'main' ? (
              <button type="button" className="pdt-back" aria-label="Back" onClick={() => setView('main')}>
                ‹
              </button>
            ) : null}
            <span className="pdt-head-title">{view === 'main' ? 'Dev tools' : VIEW_TITLE[view]}</span>
            {draft !== null ? (
              <button
                type="button"
                title="Toggle Next.js draft mode"
                className={`pdt-head-draft ${draft ? 'pdt-on' : ''}`}
                disabled={draftBusy}
                onClick={() => void toggleDraft()}
              >
                <span>draft</span>
                <span className={`pdt-switch ${draft ? 'pdt-active' : ''}`} aria-hidden />
              </button>
            ) : (
              <span className="pdt-head-badge">dev only</span>
            )}
          </div>

          <div className="pdt-body">
            {view === 'main' ? (
              <ul className="pdt-menu">
                <MenuRow label="Info" hint={snapshot ? snapshot.env.nodeEnv : undefined} onClick={() => setView('info')} />
                {snapshot?.plugins.seed !== false ? (
                  <MenuRow
                    label="Seed"
                    hint={seed ? (seed.seeded ? `${seed.totalDocs} docs` : 'empty') : undefined}
                    onClick={() => setView('seed')}
                  />
                ) : null}
                <MenuRow label="Pages" hint={pathname.startsWith(base) ? pathname : undefined} onClick={() => setView('pages')} />
                {tests.length ? <MenuRow label="Tests" hint={`${tests.length}`} onClick={() => setView('tests')} /> : null}
                <MenuRow label="Settings" onClick={() => setView('settings')} />
              </ul>
            ) : null}

            {view === 'info' ? (
              <div>
                {snapshotError ? <SnapshotMissing retry={fetchSnapshot} /> : null}
                {snapshot ? (
                  <>
                    <div className="pdt-card">
                      <div className="pdt-card-head">
                        <span className="pdt-card-title">Environment</span>
                        <button type="button" className="pdt-kind" onClick={fetchSnapshot}>
                          refresh
                        </button>
                      </div>
                      <p className="pdt-small" style={{ margin: 0 }}>
                        <span className="pdt-code">{snapshot.env.nodeEnv}</span> · node {snapshot.env.nodeVersion}
                      </p>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }} className="pdt-small">
                        {Object.entries(snapshot.plugins).map(([name, on]) => (
                          <span key={name}>
                            <span className={`pdt-dot ${on ? 'pdt-dot-on' : 'pdt-dot-off'}`} />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pdt-card">
                      <div className="pdt-card-head">
                        <span className="pdt-card-title">Collections</span>
                      </div>
                      <table className="pdt-table">
                        <tbody>
                          {snapshot.collections.map((c) => (
                            <tr key={c.slug}>
                              <td>{c.slug}</td>
                              <td>{c.count ?? '?'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {snapshot.icons ? (
                      <div className="pdt-card">
                        <div className="pdt-card-head">
                          <span className="pdt-card-title">Icons</span>
                          <span className="pdt-kind">{snapshot.icons.iconCount ?? '?'}</span>
                        </div>
                        <p className="pdt-small" style={{ margin: 0 }}>
                          Active set: {snapshot.icons.activeSet ?? <span className="pdt-warn">none</span>}
                        </p>
                        {snapshot.icons.misses.length ? (
                          <p className="pdt-small pdt-warn" style={{ margin: '6px 0 0' }}>
                            Misses:{' '}
                            {snapshot.icons.misses.map((m) => (
                              <span key={m.name} className="pdt-code" style={{ marginRight: 5 }}>
                                {m.name} ×{m.count}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {snapshot.fonts ? (
                      <div className="pdt-card">
                        <div className="pdt-card-head">
                          <span className="pdt-card-title">Fonts</span>
                          <span className="pdt-kind">{snapshot.fonts.fontCount ?? '?'}</span>
                        </div>
                        <table className="pdt-table">
                          <tbody>
                            {snapshot.fonts.familyKeys.map((key) => (
                              <tr key={key}>
                                <td>{key}</td>
                                <td>{snapshot.fonts?.slots[key] ?? 'unset'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {snapshot.mux ? (
                      <div className="pdt-card">
                        <div className="pdt-card-head">
                          <span className="pdt-card-title">Mux</span>
                          <span className="pdt-kind">
                            {snapshot.mux.total ?? '?'} / {snapshot.mux.ready ?? '?'} ready
                          </span>
                        </div>
                        {!snapshot.mux.credentialed ? (
                          <p className="pdt-small pdt-warn" style={{ margin: 0 }}>
                            MUX_TOKEN_ID / MUX_TOKEN_SECRET not set
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : !snapshotError ? (
                  <p className="pdt-note">Loading…</p>
                ) : null}
              </div>
            ) : null}

            {view === 'seed' ? (
              <div>
                {snapshotError ? <SnapshotMissing retry={fetchSnapshot} /> : null}
                {snapshot && !seed ? (
                  <p className="pdt-note">
                    <span className="pdt-code">@pro-laico/payload-seed</span> isn't installed — add{' '}
                    <span className="pdt-code">seedPlugin()</span> to get one-click seeding here.
                  </p>
                ) : null}
                {seed ? (
                  <div className="pdt-card">
                    <div className="pdt-card-head">
                      <span className="pdt-card-title">{seed.seeded ? `Seeded — ${seed.totalDocs} docs` : 'Not seeded'}</span>
                      {!seed.enabled ? <span className="pdt-kind pdt-warn">locked</span> : null}
                    </div>
                    {seed.definitions.length ? (
                      <table className="pdt-table">
                        <tbody>
                          {seed.definitions.map((d) => (
                            <tr key={d.slug}>
                              <td>
                                {d.slug}
                                {d.disabled ? <span className="pdt-warn"> · skipped</span> : null}
                              </td>
                              <td>{d.kind === 'global' ? 'global' : (seed.counts[d.slug] ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="pdt-note" style={{ margin: 0 }}>
                        No seed definitions registered.
                      </p>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={`pdt-btn ${seed.seeded ? 'pdt-btn-danger' : 'pdt-btn-primary'}`}
                        disabled={seeding}
                        onClick={() => (seed.seeded && !confirming ? setConfirming(true) : void runSeed())}
                      >
                        {seeding ? 'Seeding…' : confirming ? 'Destructive — click again' : seed.seeded ? 'Reseed' : 'Seed the database'}
                      </button>
                      {confirming ? (
                        <button type="button" className="pdt-btn" onClick={() => setConfirming(false)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                    {!seed.enabled ? (
                      <p className="pdt-note">
                        Set <span className="pdt-code">ENABLE_SEED=true</span> in <span className="pdt-code">.env.local</span> — the seed wipes
                        seeded collections, so it's off by default.
                      </p>
                    ) : null}
                    <p className="pdt-note" style={{ marginBottom: 0 }}>
                      Needs a logged-in{' '}
                      <a href={snapshot?.adminRoute ?? '/admin'} style={{ textDecoration: 'underline' }}>
                        admin
                      </a>{' '}
                      user · CLI: <span className="pdt-code">ENABLE_SEED=true pnpm seed</span>
                    </p>
                    {seedError ? (
                      <div className="pdt-error">
                        {seedError.error}
                        {seedError.issues?.length ? (
                          <ul>
                            {seedError.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'pages' ? (
              <div>
                <ul className="pdt-menu">
                  {pageLinks.map((link) =>
                    link.href.startsWith('http') ? (
                      <li key={link.href}>
                        <a className="pdt-menu-row" href={link.href} target="_blank" rel="noreferrer">
                          <span>{link.title}</span>
                          <span className="pdt-menu-hint">{link.href.replace(/^https?:\/\//, '')}</span>
                        </a>
                      </li>
                    ) : (
                      <li key={link.href}>
                        <Link className={`pdt-menu-row ${pathname === link.href ? 'pdt-current' : ''}`} href={link.href}>
                          <span>{link.title}</span>
                          <span className="pdt-menu-hint">{link.href}</span>
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
                {!snapshot && !snapshotError ? <p className="pdt-note">Loading plugin pages…</p> : null}
                {snapshotError ? <SnapshotMissing retry={fetchSnapshot} /> : null}
              </div>
            ) : null}

            {view === 'tests' ? (
              <div>
                {tests.map((t) => {
                  // header/footer kinds are chrome OVERRIDES: chips swap the variant into the real
                  // layout site-wide (via resolveDevChrome) instead of opening a test page.
                  if (t.kind === 'header' || t.kind === 'footer') {
                    const slot = t.kind
                    const active = chrome[slot]?.testKey === t.key ? chrome[slot] : null
                    return (
                      <div key={t.key} className="pdt-card">
                        <div className="pdt-card-head">
                          <span className="pdt-card-title">{t.label}</span>
                          <span className="pdt-kind">{active ? <span className="pdt-viewing">override on</span> : `${t.kind} override`}</span>
                        </div>
                        <div className="pdt-chips">
                          <button type="button" className={`pdt-chip ${active ? '' : 'pdt-active'}`} onClick={() => selectChrome(slot, null)}>
                            Real
                          </button>
                          {t.versions.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className={`pdt-chip ${active?.versionId === v.id ? 'pdt-active' : ''}`}
                              onClick={() => selectChrome(slot, { testKey: t.key, versionId: v.id })}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  const testPath = `${base}/tests/${t.key}`
                  const onPage = pathname === testPath
                  // The page defaults to the first version when no cookie targets this test.
                  const selectedId = selection?.testKey === t.key ? selection.versionId : t.versions[0]?.id
                  return (
                    <div key={t.key} className="pdt-card">
                      <div className="pdt-card-head">
                        <Link href={testPath} className="pdt-card-title" style={{ textDecoration: onPage ? 'none' : undefined }}>
                          {t.label} {onPage ? null : <span aria-hidden>›</span>}
                        </Link>
                        <span className="pdt-kind">{onPage ? <span className="pdt-viewing">viewing</span> : t.kind}</span>
                      </div>
                      <div className="pdt-chips">
                        {t.versions.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            className={`pdt-chip ${selectedId === v.id ? 'pdt-active' : ''}`}
                            onClick={() => selectVersion(t.key, v.id)}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p className="pdt-note">
                  Page tests open as their own page; header/footer overrides swap into the live layout everywhere until you hit Real. Scriptable
                  via <span className="pdt-code">/api/dev/stage?test=…&version=…</span>
                </p>
              </div>
            ) : null}

            {view === 'settings' ? (
              <div>
                <div className="pdt-settings-row">
                  <span className="pdt-small pdt-muted">Corner</span>
                  <div className="pdt-corner-grid">
                    {CORNERS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        aria-label={c.value}
                        className={`pdt-corner-btn ${settings.corner === c.value ? 'pdt-active' : ''}`}
                        onClick={() => update({ corner: c.value })}
                      >
                        {c.arrow}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pdt-settings-row">
                  <span className="pdt-small pdt-muted">Size</span>
                  <div className="pdt-seg">
                    {SIZES.map((s) => (
                      <button key={s} type="button" className={settings.size === s ? 'pdt-active' : ''} onClick={() => update({ size: s })}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '6px 4px 2px' }}>
                  <button
                    type="button"
                    className="pdt-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(HIDE_KEY, '1')
                      } catch {}
                      setHidden(true)
                      setOpen(false)
                    }}
                  >
                    Hide for this session
                  </button>
                  <p className="pdt-note" style={{ textAlign: 'center' }}>
                    reopens in a new tab / session
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Dev tools"
        title="Dev tools"
        className={`pdt-fab pdt-fab-${settings.size} ${open ? 'pdt-open' : ''}`}
        onClick={() => {
          setOpen((v) => !v)
          setView('main')
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 8 4 4-4 4" />
          <path d="M13 16h6" />
        </svg>
      </button>
    </div>
  )
}

const MenuRow = ({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) => (
  <li>
    <button type="button" className="pdt-menu-row" onClick={onClick}>
      <span>{label}</span>
      <span className="pdt-menu-hint">
        {hint ? <span>{hint}</span> : null}
        <span aria-hidden>›</span>
      </span>
    </button>
  </li>
)

const SnapshotMissing = ({ retry }: { retry: () => Promise<void> }) => (
  <p className="pdt-note">
    <span className="pdt-warn">Couldn't reach /api/dev.</span> Is <span className="pdt-code">devToolsPlugin()</span> in your Payload plugins
    list?{' '}
    <button type="button" style={{ textDecoration: 'underline' }} onClick={() => void retry()}>
      Retry
    </button>
  </p>
)

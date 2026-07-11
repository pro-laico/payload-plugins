'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SeedError, SeedSnapshot, SpecimenStyle } from '../types'

/** The `/dev` index's seed controls — same flow as the toolbar's Seed view: POST the seed
 *  plugin's own endpoint, two-click confirm when destructive, surface `{ error, issues }`. */
export function SeedCard({ seed, adminRoute }: { seed: SeedSnapshot; adminRoute: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<SeedError | null>(null)

  const runSeed = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setConfirming(false)
        router.refresh()
      } else {
        const body = (await res.json().catch(() => null)) as SeedError | null
        setError(body?.error ? body : { error: `Seed failed (HTTP ${res.status}).` })
        setConfirming(false)
      }
    } catch {
      setError({ error: 'Seed request failed — is the dev server running?' })
      setConfirming(false)
    }
    setRunning(false)
  }

  return (
    <div className="pdtp-card">
      <h2>
        {seed.seeded ? `Seeded — ${seed.totalDocs} docs` : 'Not seeded'}
        {!seed.enabled ? <span className="pdtp-kind pdtp-warn">locked</span> : <span className="pdtp-kind">seed</span>}
      </h2>
      <table className="pdtp-table">
        <tbody>
          {seed.definitions.map((d) => (
            <tr key={d.slug}>
              <td>
                {d.slug}
                {d.disabled ? <span className="pdtp-warn"> · skipped</span> : null}
              </td>
              <td>{d.kind === 'global' ? 'global' : (seed.counts[d.slug] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={`pdtp-btn ${seed.seeded ? 'pdtp-btn-danger' : 'pdtp-btn-primary'}`}
          disabled={running}
          onClick={() => (seed.seeded && !confirming ? setConfirming(true) : void runSeed())}
        >
          {running ? 'Seeding…' : confirming ? 'Destructive — click again' : seed.seeded ? 'Reseed' : 'Seed the database'}
        </button>
        {confirming ? (
          <button type="button" className="pdtp-btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        ) : null}
      </div>
      {!seed.enabled ? (
        <p className="pdtp-note">
          Set <span className="pdtp-code">ENABLE_SEED=true</span> in <span className="pdtp-code">.env.local</span> — the seed wipes seeded
          collections, so it's off by default.
        </p>
      ) : null}
      <p className="pdtp-note">
        Needs a logged-in <a href={adminRoute}>admin</a> user · CLI: <span className="pdtp-code">ENABLE_SEED=true pnpm seed</span>
      </p>
      {error ? (
        <div className="pdtp-error">
          {error.error}
          {error.issues?.length ? (
            <ul>
              {error.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** The `/dev/fonts` interactive specimen — the sample renders in the family's `--font-set*`
 *  variable at the clicked weight/style. Only weights and styles the typeface actually serves
 *  are offered. */
export function FontSpecimen({
  familyKey,
  title,
  cssVar,
  styles,
}: {
  familyKey: string
  title: string | null
  cssVar: string
  styles: SpecimenStyle[]
}) {
  const [styleIdx, setStyleIdx] = useState(0)
  const current = styles[Math.min(styleIdx, styles.length - 1)]
  const [weight, setWeight] = useState(current?.weights.includes(400) ? 400 : (current?.weights[0] ?? 400))

  const pickStyle = (idx: number) => {
    setStyleIdx(idx)
    const next = styles[idx]
    if (next && !next.weights.includes(weight)) setWeight(next.weights.includes(400) ? 400 : (next.weights[0] ?? 400))
  }

  return (
    <div className="pdtp-specimen">
      <div className="pdtp-specimen-head">
        <span>
          <span className="pdtp-code">{familyKey}</span>{' '}
          <span className="pdtp-kind" style={{ marginLeft: 6 }}>
            {title ?? 'slot unset — fallback stack'}
            {current ? ` · ${current.label}` : ''}
          </span>
        </span>
        {styles.length > 1 ? (
          <span className="pdtp-seg">
            {styles.map((s, idx) => (
              <button key={s.style} type="button" className={idx === styleIdx ? 'pdtp-active' : ''} onClick={() => pickStyle(idx)}>
                {s.style === 'normal' ? 'upright' : 'italic'}
              </button>
            ))}
          </span>
        ) : current ? (
          <span className="pdtp-kind">{current.style === 'normal' ? 'upright only' : 'italic only'}</span>
        ) : null}
      </div>

      <div style={{ fontFamily: cssVar, fontWeight: weight, fontStyle: current?.style ?? 'normal' }}>
        <p className="pdtp-specimen-big">The quick brown fox jumps over the lazy dog.</p>
        <p className="pdtp-specimen-body">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 — 1,234.56 · «fi ffi» ?!&</p>
      </div>

      {current ? (
        <div className="pdtp-chips" style={{ marginTop: 14 }}>
          {current.weights.map((w) => (
            <button key={w} type="button" className={`pdtp-chip ${w === weight ? 'pdtp-active' : ''}`} onClick={() => setWeight(w)}>
              {w}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The `/dev/icons` set switcher — activates a set via `POST /api/dev/icons/activate` and
 *  refreshes, so the grid (and the whole site) re-skins to the newly active set. */
export function IconSetSwitcher({ sets }: { sets: { id: string | number; title: string; active: boolean }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activate = async (id: string | number) => {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch('/api/dev/icons/activate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) router.refresh()
      else setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Failed (HTTP ${res.status}).`)
    } catch {
      setError('Request failed — is the dev server running?')
    }
    setBusy(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sets.map((set) => (
          <button
            key={set.id}
            type="button"
            className={`pdtp-btn ${set.active ? 'pdtp-btn-primary' : ''}`}
            disabled={busy !== null || set.active}
            onClick={() => void activate(set.id)}
          >
            {busy === set.id ? 'Activating…' : set.title}
            {set.active ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {error ? <div className="pdtp-error">{error}</div> : null}
    </div>
  )
}

/** The `/dev/revalidate` manual bust box — POST one tag to payload-revalidate's map
 *  endpoint and refresh, so the event log shows the manual bust immediately. */
export function BustTagCard({ endpointPath }: { endpointPath: string }) {
  const router = useRouter()
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bust = async () => {
    if (!tag.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(endpointPath, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tag: tag.trim() }),
      })
      if (res.ok) {
        setTag('')
        router.refresh()
      } else setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Failed (HTTP ${res.status}).`)
    } catch {
      setError('Request failed — is the dev server running?')
    }
    setBusy(false)
  }

  return (
    <div className="pdtp-card" style={{ marginTop: 20 }}>
      <h2>
        Bust a tag <span className="pdtp-kind">manual</span>
      </h2>
      <form
        style={{ display: 'flex', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault()
          void bust()
        }}
      >
        <input
          className="pdtp-code"
          style={{ flex: 1, padding: '6px 10px' }}
          placeholder="posts:42 · posts · global:header · all"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <button type="submit" className="pdtp-btn pdtp-btn-primary" disabled={busy || !tag.trim()}>
          {busy ? 'Busting…' : 'Bust'}
        </button>
      </form>
      {error ? <div className="pdtp-error">{error}</div> : null}
    </div>
  )
}

'use client'

import { useState } from 'react'

import type { SeedError, SeedPanelProps } from './types'

export function SeedPanel({ seeded, counts = {}, note }: SeedPanelProps) {
  const [running, setRunning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<SeedError | null>(null)

  const seededEntries = Object.entries(counts).filter(([, n]) => n > 0)
  const totalDocs = seededEntries.reduce((sum, [, n]) => sum + n, 0)

  const runSeed = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        location.reload()
        return
      }
      const body = (await res.json().catch(() => null)) as SeedError | null //TODO: replace `as` cast with proper typing
      setError(body?.error ? body : { error: `Seed failed (HTTP ${res.status}).` })
    } catch {
      setError({ error: 'Seed request failed — is the dev server running?' })
    }
    setRunning(false)
    setConfirming(false)
  }

  // Reseed is destructive (the engine deletes seeded collections first) — two-click confirm.
  const onReseed = () => (confirming ? void runSeed() : setConfirming(true))

  return (
    <div className="shell-card">
      {seeded ? (
        <>
          <p style={{ margin: '0 0 12px' }}>
            <strong>
              Seeded — {totalDocs} doc{totalDocs === 1 ? '' : 's'} across {seededEntries.length} collection
              {seededEntries.length === 1 ? '' : 's'}
            </strong>{' '}
            <small className="shell-muted">{seededEntries.map(([slug, n]) => `${slug} ${n}`).join(' · ')}</small>
          </p>
          <div className="shell-row">
            <button className="shell-btn shell-btn--danger" type="button" disabled={running} onClick={onReseed}>
              {running ? 'Reseeding…' : confirming ? 'Reseed is destructive — click again to confirm' : 'Reseed'}
            </button>
            <a className="shell-btn shell-btn--ghost" href="/admin">
              Open admin →
            </a>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Seed the database</h2>
          <ol className="shell-seed-steps">
            <li>
              <button className="shell-btn" type="button" disabled={running} onClick={runSeed}>
                {running ? 'Seeding…' : 'Seed the database'}
              </button>
            </li>
            <li>
              …or click <strong>Seed your database</strong> in the <a href="/admin">admin</a> header.
            </li>
            <li>
              …or <code>ENABLE_SEED=true pnpm seed</code> from the CLI.
            </li>
          </ol>
          <p className="shell-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            The button paths need <code>ENABLE_SEED=true</code> in <code>.env.local</code> and a logged-in <a href="/admin">admin</a> user.
          </p>
        </>
      )}
      {note ? (
        <p className="shell-muted" style={{ margin: '12px 0 0', fontSize: '0.85rem' }}>
          {note}
        </p>
      ) : null}
      {error ? (
        <div className="shell-seed-error">
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

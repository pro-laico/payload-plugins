'use client'

import { type CSSProperties, useState } from 'react'

/**
 * Triggers `POST /api/seed` (the seed plugin's endpoint) and reloads so the freshly seeded fonts
 * render. The endpoint requires `ENABLE_SEED=true` and an authenticated admin session — if either
 * is missing it returns 403, which this surfaces inline (with a link to log in / seed from the
 * admin instead). Self-styled so it doesn't depend on page CSS.
 */
const btn: CSSProperties = {
  background: '#4ade80',
  color: '#0a0a0a',
  border: 0,
  borderRadius: 8,
  padding: '9px 14px',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}
const ghost: CSSProperties = { ...btn, background: 'transparent', color: '#ededed', border: '1px solid #2a2a2a' }

export function SeedControls() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const seed = async () => {
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST', credentials: 'include' })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus('error')
        setMessage(body.error ?? `Seed failed (HTTP ${res.status}).`)
        return
      }
      // Reload so the server component re-reads the seeded fonts and renders the specimens.
      window.location.reload()
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Seed request failed.')
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <button type="button" style={{ ...btn, opacity: status === 'loading' ? 0.6 : 1 }} onClick={seed} disabled={status === 'loading'}>
        {status === 'loading' ? 'Seeding…' : 'Seed the database'}
      </button>
      <a style={ghost} href="/admin">
        Open admin
      </a>
      {status === 'error' && message ? (
        <p style={{ color: '#f3b14a', fontSize: '0.85rem', flexBasis: '100%', margin: '4px 0 0' }}>
          {message} You can also seed from the <a href="/admin">admin dashboard</a> (set <code>ENABLE_SEED=true</code> and log in first).
        </p>
      ) : null}
    </div>
  )
}

export default SeedControls

'use client'

import type React from 'react'
import { useState } from 'react'
import { toast, useConfig, useDocumentInfo } from '@payloadcms/ui'

import type { PurgeVariantsProps } from '../../types'

const button: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '0.4rem 0.75rem',
  color: 'var(--theme-elevation-800)',
  background: 'var(--theme-elevation-50)',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-150)',
}

const note: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: '0.8rem', margin: '0.25rem 0 0' }

export const PurgeVariants: React.FC<PurgeVariantsProps> = ({ purgePath = '/img/purge' }) => {
  const { config } = useConfig()
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const apiRoute = config?.routes?.api || '/api'

  if (id == null) return null

  const purge = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await fetch(`${apiRoute}${purgePath}/${id}`, { method: 'POST', credentials: 'include' })
      const raw: unknown = await res.json().catch(() => null)
      const json = typeof raw === 'object' && raw !== null ? raw : {}
      const errorMsg = 'error' in json && typeof json.error === 'string' ? json.error : undefined
      if (!res.ok) throw new Error(errorMsg || `HTTP ${res.status}`)
      const n = 'deleted' in json && typeof json.deleted === 'number' ? json.deleted : 0
      toast.success(`Purged ${n} generated image${n === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to purge variants.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button type="button" onClick={() => void purge()} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Purging…' : 'Purge generated variants'}
      </button>
      <p style={note}>Deletes every on-demand image generated from this source. They regenerate on next request.</p>
    </div>
  )
}

export default PurgeVariants

'use client'

import type React from 'react'
import { useState } from 'react'
import { useField, useForm } from '@payloadcms/ui'

import type { PresetEntry, PresetManagerProps } from '../../types'

const wrap: React.CSSProperties = { marginBottom: '1rem' }
const label: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--theme-elevation-600)', margin: '0 0 0.4rem' }
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }
const chip = (active: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  fontSize: '0.8rem',
  padding: '0.3rem 0.7rem',
  borderRadius: '999px',
  border: `1px solid ${active ? 'var(--theme-success-500, #2b8a3e)' : 'var(--theme-elevation-150)'}`,
  background: active ? 'var(--theme-success-100, #ebfbee)' : 'var(--theme-elevation-50)',
  color: active ? 'var(--theme-success-800, #1b5e2b)' : 'var(--theme-elevation-700)',
})
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }
const input: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.3rem 0.45rem',
  width: '5.5rem',
  background: 'var(--theme-input-bg, var(--theme-elevation-50))',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-s, 3px)',
  color: 'var(--theme-elevation-800)',
}
const btn: React.CSSProperties = { ...chip(false), border: '1px solid var(--theme-elevation-200)' }
const note: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: '0.75rem', margin: '0.5rem 0 0' }

const isCustom = (e: PresetEntry): boolean => !e.template && !!e.name
const num = (s: string): number | undefined => {
  const n = Number(s)
  return s.trim() && Number.isFinite(n) ? n : undefined
}

/**
 * Edits the hidden `presets` array: config template toggle-chips (active = a `{ template }` entry)
 * plus an "add custom preset" form (a `{ name, …spec }` entry). Presets are guaranteed, cap-exempt
 * variants served at `/api/img/:id?preset=<name>`.
 */
export const PresetManager: React.FC<PresetManagerProps> = ({ templates = [] }) => {
  const { value, setValue } = useField<PresetEntry[]>({ path: 'presets' })
  const { setModified } = useForm()
  const entries = Array.isArray(value) ? value : []
  const [draft, setDraft] = useState<Record<string, string>>({})

  const commit = (next: PresetEntry[]): void => {
    setValue(next)
    setModified(true)
  }

  const toggleTemplate = (name: string): void => {
    const has = entries.some((e) => e.template === name)
    commit(has ? entries.filter((e) => e.template !== name) : [...entries, { template: name }])
  }

  const addCustom = (): void => {
    const name = (draft.name ?? '').trim()
    if (!name) return
    const entry: PresetEntry = {
      name,
      width: num(draft.width ?? ''),
      height: num(draft.height ?? ''),
      aspectRatio: (draft.aspectRatio?.trim() || undefined) as PresetEntry['aspectRatio'],
      fit: (draft.fit?.trim() || undefined) as PresetEntry['fit'],
      quality: num(draft.quality ?? ''),
      format: (draft.format?.trim() || undefined) as PresetEntry['format'],
    }
    commit([...entries.filter((e) => e.name !== name || e.template), entry])
    setDraft({})
  }

  const removeCustom = (name: string): void => commit(entries.filter((e) => !(isCustom(e) && e.name === name)))
  const set = (k: string, v: string): void => setDraft((d) => ({ ...d, [k]: v }))
  const custom = entries.filter(isCustom)

  return (
    <div style={wrap}>
      <p style={label}>Preset templates</p>
      {templates.length ? (
        <div style={chips}>
          {templates.map((t) => {
            const active = entries.some((e) => e.template === t)
            return (
              <button key={t} type="button" style={chip(active)} onClick={() => toggleTemplate(t)}>
                {active ? '✓ ' : '+ '}
                {t}
              </button>
            )
          })}
        </div>
      ) : (
        <p style={note}>{'No preset templates configured. Add some via imagesPlugin({ presetTemplates }), or a custom preset below.'}</p>
      )}

      <p style={label}>Custom presets</p>
      {custom.length ? (
        <div style={{ ...chips, flexDirection: 'column', alignItems: 'flex-start' }}>
          {custom.map((e) => (
            <div key={e.name ?? ''} style={row}>
              <span style={chip(true)}>{e.name}</span>
              <span style={note}>
                {[e.width && `${e.width}w`, e.aspectRatio, e.fit, e.quality && `q${e.quality}`, e.format].filter(Boolean).join(' · ')}
              </span>
              <button type="button" style={btn} onClick={() => removeCustom(e.name ?? '')}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={row}>
        <input style={input} placeholder="name" value={draft.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        <input style={input} placeholder="width" value={draft.width ?? ''} onChange={(e) => set('width', e.target.value)} />
        <input style={input} placeholder="height" value={draft.height ?? ''} onChange={(e) => set('height', e.target.value)} />
        <input style={input} placeholder="16:9" value={draft.aspectRatio ?? ''} onChange={(e) => set('aspectRatio', e.target.value)} />
        <input style={input} placeholder="fit" value={draft.fit ?? ''} onChange={(e) => set('fit', e.target.value)} />
        <input style={input} placeholder="q" value={draft.quality ?? ''} onChange={(e) => set('quality', e.target.value)} />
        <input style={input} placeholder="format" value={draft.format ?? ''} onChange={(e) => set('format', e.target.value)} />
        <button type="button" style={btn} onClick={addCustom}>
          Add
        </button>
      </div>
      <p style={note}>
        {"Presets are always generatable (never capped) and pre-generated on save. Serve one with getImageUrl(img, { preset: 'name' })."}
      </p>
    </div>
  )
}

export default PresetManager

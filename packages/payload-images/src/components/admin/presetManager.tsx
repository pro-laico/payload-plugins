'use client'

import type React from 'react'
import { useState } from 'react'
import { useAllFormFields, useForm } from '@payloadcms/ui'

import { ENCODABLE_FORMATS, FITS } from '../../lib/transform/params'
import type { PresetEntry, PresetManagerProps, PresetSpec } from '../../types'

// ——— styles (Payload admin theme vars, matching the focalPreview card) ———
const card: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '0.75rem',
  maxWidth: 760,
  borderRadius: 'var(--style-radius-m, 4px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-elevation-50)',
}
const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--theme-elevation-500)',
  margin: '0 0 0.4rem',
}
const note: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: '0.8rem', margin: 0 }
const errText: React.CSSProperties = { color: 'var(--theme-error-500, #d33)', fontSize: '0.75rem', margin: '0.35rem 0 0' }
const namePill: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  padding: '0.15rem 0.55rem',
  borderRadius: 999,
  background: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-800)',
  whiteSpace: 'nowrap',
}
const sourceTag: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.1rem 0.4rem',
  borderRadius: 3,
  background: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-500)',
  whiteSpace: 'nowrap',
}
const specText: React.CSSProperties = { flex: 1, fontSize: '0.78rem', color: 'var(--theme-elevation-600)', minWidth: 0 }
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.45rem 0.6rem',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
}
const iconBtn: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: '0.75rem',
  lineHeight: 1,
  padding: '0.3rem 0.45rem',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--theme-elevation-500)',
}
const addChip: React.CSSProperties = {
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.4rem',
  fontSize: '0.8rem',
  padding: '0.3rem 0.7rem',
  borderRadius: 999,
  border: '1px dashed var(--theme-elevation-250)',
  background: 'transparent',
  color: 'var(--theme-elevation-700)',
}
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.68rem',
  color: 'var(--theme-elevation-500)',
  margin: '0 0 0.2rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '0.8rem',
  padding: '0.35rem 0.45rem',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-s, 3px)',
  color: 'var(--theme-elevation-800)',
}
const invalidInput: React.CSSProperties = { borderColor: 'var(--theme-error-500, #d33)' }
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  cursor: disabled ? 'default' : 'pointer',
  fontSize: '0.8rem',
  padding: '0.4rem 0.9rem',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-800)',
  background: disabled ? 'var(--theme-elevation-100)' : 'var(--theme-elevation-800)',
  color: disabled ? 'var(--theme-elevation-400)' : 'var(--theme-elevation-0)',
  ...(disabled ? { borderColor: 'var(--theme-elevation-150)' } : {}),
})

// ——— pure helpers ———
/** "1200×630 · cover · q80 · jpeg" — the settings a preset resolves to. */
const specSummary = (s: PresetSpec): string =>
  [
    s.width && s.height ? `${s.width}×${s.height}` : s.width ? `${s.width}w` : s.height ? `${s.height}h` : null,
    typeof s.aspectRatio === 'number' ? String(s.aspectRatio) : s.aspectRatio,
    s.fit,
    s.quality && `q${s.quality}`,
    s.format,
  ]
    .filter(Boolean)
    .join(' · ') || 'endpoint defaults'

const isCustom = (e: PresetEntry): boolean => !e.template && !!e.name

/** A preset row read out of form state, tagged with its row index so it can be removed. */
type RowEntry = PresetEntry & { rowIndex: number }

/** One row's subfield state for `addFieldRow` — value + initialValue per leaf. */
const toSubFieldState = (entry: PresetEntry): Record<string, { initialValue: unknown; valid: true; value: unknown }> =>
  Object.fromEntries(
    Object.entries(entry)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, { initialValue: v, valid: true, value: v }]),
  )

const NAME_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
const RATIO_RE = /^\d+:\d+$/
const isInt = (s: string): boolean => /^\d+$/.test(s.trim())

type Draft = { name: string; width: string; height: string; aspectRatio: string; fit: string; quality: string; format: string }
const EMPTY_DRAFT: Draft = { name: '', width: '', height: '', aspectRatio: '', fit: '', quality: '', format: '' }

/** Field-keyed validation of the custom-preset draft; empty result = addable. */
const validateDraft = (d: Draft, takenNames: Set<string>): Partial<Record<keyof Draft | 'geometry', string>> => {
  const errs: Partial<Record<keyof Draft | 'geometry', string>> = {}
  const name = d.name.trim()
  if (!name) errs.name = 'Name is required.'
  else if (!NAME_RE.test(name)) errs.name = 'Lowercase letters, digits, - or _ (it goes in the URL).'
  else if (takenNames.has(name)) errs.name = `“${name}” is already taken on this image.`
  if (d.width.trim() && !isInt(d.width)) errs.width = 'Width must be a whole number of pixels.'
  if (d.height.trim() && !isInt(d.height)) errs.height = 'Height must be a whole number of pixels.'
  if (d.aspectRatio.trim() && !RATIO_RE.test(d.aspectRatio.trim())) errs.aspectRatio = 'Ratio must look like 16:9.'
  if (d.quality.trim() && (!isInt(d.quality) || Number(d.quality) < 1 || Number(d.quality) > 100)) errs.quality = 'Quality is 1–100.'
  if (!d.width.trim() && !d.height.trim() && !d.aspectRatio.trim()) errs.geometry = 'Give it a size: width, height, or an aspect ratio.'
  return errs
}

const draftToEntry = (d: Draft): PresetEntry => ({
  name: d.name.trim(),
  ...(d.width.trim() ? { width: Number(d.width) } : {}),
  ...(d.height.trim() ? { height: Number(d.height) } : {}),
  ...(d.aspectRatio.trim() ? { aspectRatio: d.aspectRatio.trim() as PresetEntry['aspectRatio'] } : {}),
  ...(d.fit ? { fit: d.fit as PresetEntry['fit'] } : {}),
  ...(d.quality.trim() ? { quality: Number(d.quality) } : {}),
  ...(d.format ? { format: d.format as PresetEntry['format'] } : {}),
})

/**
 * Edits the hidden `presets` array — the image's guaranteed variants (cap-exempt, pre-generated
 * on save, served at `/api/img/:id?preset=<name>`). Active presets are listed with the settings
 * they resolve to; config templates one click away; custom presets built in a validated form.
 */
export const PresetManager: React.FC<PresetManagerProps> = ({ templates = {} }) => {
  // The `presets` array lives in form state as ROWS (`presets.N.<leaf>`) — the array path's own
  // `value` is just the row count. Read each row's leaves and mutate via the rows API; a plain
  // useField(path: 'presets') setValue would desync the rows and read nothing after a save.
  const { addFieldRow, removeFieldRow } = useForm()
  const [fields] = useAllFormFields()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [attempted, setAttempted] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const rowCount = fields?.presets?.rows?.length ?? 0
  const entries: RowEntry[] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const leaf = (key: string): unknown => fields[`presets.${rowIndex}.${key}`]?.value
    const str = (key: string): string | null => (typeof leaf(key) === 'string' && leaf(key) !== '' ? (leaf(key) as string) : null) //EXCUSE: narrowed by the typeof check in the same expression
    const num = (key: string): number | undefined => (typeof leaf(key) === 'number' ? (leaf(key) as number) : undefined) //EXCUSE: narrowed by the typeof check in the same expression
    return {
      rowIndex,
      template: str('template'),
      name: str('name'),
      width: num('width'),
      height: num('height'),
      aspectRatio: (str('aspectRatio') as PresetEntry['aspectRatio']) ?? undefined, //EXCUSE: the text field stores the "16:9" template-literal form as a plain string
      fit: (str('fit') as PresetEntry['fit']) ?? undefined, //EXCUSE: select-field state carries the option union as a plain string
      quality: num('quality'),
      format: (str('format') as PresetEntry['format']) ?? undefined, //EXCUSE: select-field state carries the option union as a plain string
    }
  })

  const activeTemplates = entries.filter((e) => e.template)
  const customs = entries.filter(isCustom)
  const inactiveTemplates = Object.entries(templates).filter(([name]) => !entries.some((e) => e.template === name))
  const takenNames = new Set<string>([...Object.keys(templates), ...customs.map((e) => e.name ?? '')])

  const errors = validateDraft(draft, takenNames)
  const showErrors = attempted // only complain once they try to add
  const fieldErr = (k: keyof Draft | 'geometry'): string | undefined => (showErrors ? errors[k] : undefined)

  const addEntry = (entry: PresetEntry): void =>
    addFieldRow({ path: 'presets', schemaPath: 'presets', subFieldState: toSubFieldState(entry) as never }) //EXCUSE: subFieldState wants full FormState fields; the reducer only reads value/initialValue/valid
  const addTemplate = (name: string): void => addEntry({ template: name })
  const removeEntry = (entry: RowEntry): void => removeFieldRow({ path: 'presets', rowIndex: entry.rowIndex })

  const addCustom = (): void => {
    setAttempted(true)
    if (Object.keys(errors).length) return
    addEntry(draftToEntry(draft))
    setDraft(EMPTY_DRAFT)
    setAttempted(false)
    setShowForm(false)
  }

  const set =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  const textField = (k: keyof Draft, label: string, placeholder: string, opts?: { flex?: number; type?: string }): React.ReactElement => (
    <div style={{ flex: opts?.flex ?? 1, minWidth: 72 }}>
      <label style={fieldLabel}>
        {label}
        <input
          type={opts?.type ?? 'text'}
          inputMode={opts?.type === 'number' ? 'numeric' : undefined}
          min={opts?.type === 'number' ? 1 : undefined}
          style={{ ...inputStyle, marginTop: '0.2rem', ...(fieldErr(k) ? invalidInput : {}) }}
          placeholder={placeholder}
          value={draft[k]}
          onChange={set(k)}
        />
      </label>
    </div>
  )

  const selectField = (k: keyof Draft, label: string, options: readonly string[]): React.ReactElement => (
    <div style={{ flex: 1, minWidth: 88 }}>
      <label style={fieldLabel}>
        {label}
        <select style={{ ...inputStyle, marginTop: '0.2rem', cursor: 'pointer' }} value={draft[k]} onChange={set(k)}>
          <option value="">default</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    </div>
  )

  const presetRow = (entry: RowEntry): React.ReactElement => {
    const template = entry.template ? templates[entry.template] : undefined
    const missing = !!entry.template && !template
    const spec = template ?? entry
    return (
      <div key={entry.template ?? entry.name ?? String(entry.rowIndex)} style={rowStyle}>
        <span style={namePill}>{entry.template ?? entry.name}</span>
        <span style={{ ...specText, ...(missing ? { color: 'var(--theme-error-500, #d33)' } : {}) }}>
          {missing ? 'template no longer exists in the plugin config' : specSummary(spec)}
        </span>
        <span style={sourceTag}>{entry.template ? 'template' : 'custom'}</span>
        <button type="button" style={iconBtn} title="Remove this preset" aria-label="Remove this preset" onClick={() => removeEntry(entry)}>
          ✕
        </button>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }}>Presets</strong>
        <span style={note}>Guaranteed variants — pre-generated on save, never capped.</span>
      </div>
      <p style={{ ...note, margin: '0.35rem 0 0.75rem' }}>
        {"Each preset is always servable at a stable URL — getImageUrl(img, { preset: 'name' }) — even before anyone requests it."}
      </p>

      {activeTemplates.length || customs.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {activeTemplates.map(presetRow)}
          {customs.map(presetRow)}
        </div>
      ) : (
        <p style={{ ...note, margin: '0 0 0.75rem' }}>No presets on this image yet.</p>
      )}

      {inactiveTemplates.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={sectionLabel}>Add from config</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {inactiveTemplates.map(([name, spec]) => (
              <button key={name} type="button" style={addChip} onClick={() => addTemplate(name)}>
                <span style={{ fontWeight: 600 }}>+ {name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500)' }}>{specSummary(spec)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm ? (
        <div>
          <p style={sectionLabel}>Custom preset</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start' }}>
            {textField('name', 'Name', 'social-card', { flex: 1.4 })}
            {textField('width', 'Width px', '1200', { type: 'number' })}
            {textField('height', 'Height px', '630', { type: 'number' })}
            {textField('aspectRatio', 'Ratio', '16:9')}
            {selectField('fit', 'Fit', FITS)}
            {textField('quality', 'Quality', '80', { type: 'number' })}
            {selectField('format', 'Format', ENCODABLE_FORMATS)}
          </div>
          {showErrors && Object.keys(errors).length > 0 && (
            <p style={errText}>
              {[errors.name, errors.width, errors.height, errors.aspectRatio, errors.quality, errors.geometry].filter(Boolean).join(' ')}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <button type="button" style={primaryBtn(false)} onClick={addCustom}>
              Add preset
            </button>
            <button
              type="button"
              style={{ ...addChip, borderStyle: 'solid' }}
              onClick={() => {
                setShowForm(false)
                setDraft(EMPTY_DRAFT)
                setAttempted(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" style={addChip} onClick={() => setShowForm(true)}>
          + Custom preset
        </button>
      )}
    </div>
  )
}

export default PresetManager

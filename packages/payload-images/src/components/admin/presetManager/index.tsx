'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast, useAllFormFields, useConfig, useDocumentInfo, useField, useForm } from '@payloadcms/ui'

import { ENCODABLE_FORMATS, FITS } from '../../../lib/transform/params'
import type { PresetEntry, PresetManagerProps, PresetSpec } from '../../../types'
import {
  type PlanRow,
  type PresetMatch,
  type PrewarmView,
  type VariantPage,
  type VariantRow,
  parsePresetMatches,
  parsePrewarmStatus,
  parseVariantPage,
} from './parsers'
import {
  type Draft,
  draftToEntry,
  EMPTY_DRAFT,
  isCustom,
  isFit,
  isFormat,
  isRatio,
  type RowEntry,
  toSubFieldState,
  validateDraft,
} from './draft'
import {
  addBtn,
  card,
  cellText,
  emptyCell,
  errText,
  headerBtns,
  headerCell,
  headerRow,
  iconBtn,
  inputStyle,
  invalidInput,
  limitWrap,
  nameText,
  note,
  offStyle,
  pagerBtn,
  prewarmBtn,
  purgeBtn,
  row,
  table,
  toggleKnob,
  toggleTrack,
  variantName,
} from './styles'

export const PresetManager: React.FC<PresetManagerProps> = ({
  templates = {},
  variantSlug = 'generated-images',
  purgePath = '/img/purge',
  prewarmPath,
  presetsPath,
  pageSize = 15,
}) => {
  const [fields] = useAllFormFields()
  const { addFieldRow, removeFieldRow } = useForm()
  const { config } = useConfig()
  const { id } = useDocumentInfo()
  const { value: limitValue, setValue: setLimitValue } = useField<number | null>({ path: 'variantLimit' })
  const [attempted, setAttempted] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [purging, setPurging] = useState(false)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [variants, setVariants] = useState<VariantPage | null>(null)
  const [presetMatches, setPresetMatches] = useState<Map<string, PresetMatch> | null>(null)
  const [prewarm, setPrewarm] = useState<PrewarmView | null>(null)
  const [prewarmBusy, setPrewarmBusy] = useState(false)
  const [pollTick, setPollTick] = useState(0)
  // Set while a run is (or was just) in flight — an active→idle transition means it finished.
  const prewarmActiveRef = useRef(false)
  // Between run-finished and the refreshed variants landing, keep the last plan's ghost rows on
  // screen so the table swaps in one reflow instead of shrinking then growing.
  const [swapping, setSwapping] = useState(false)
  const swappingRef = useRef(false)
  const lastPlanRef = useRef<PlanRow[]>([])
  const apiRoute = config?.routes?.api || '/api'

  // biome-ignore lint/correctness/useExhaustiveDependencies: `refresh` is a trigger-only dep — bumping it refetches.
  useEffect(() => {
    if (id == null) return
    let cancelled = false
    const qs = `where[source][equals]=${encodeURIComponent(String(id))}&limit=${pageSize}&page=${page}&depth=0&sort=-createdAt`
    fetch(`${apiRoute}/${variantSlug}?${qs}`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then((raw) => {
        if (cancelled) return
        const parsed = parseVariantPage(raw)
        setVariants(parsed)
        // Fresh list is in — release any held ghost rows in the same commit.
        if (swappingRef.current) {
          swappingRef.current = false
          setSwapping(false)
        }
        // Deleting the last row of the last page leaves `page` past the end — walk back.
        if (parsed && parsed.totalPages >= 1 && page > parsed.totalPages) setPage(parsed.totalPages)
      })
      .catch(() => {
        if (!cancelled) setVariants(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, page, refresh, apiRoute, variantSlug, pageSize])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `refresh` is a trigger-only dep — bumping it refetches.
  useEffect(() => {
    if (!presetsPath || id == null) return
    let cancelled = false
    fetch(`${apiRoute}${presetsPath}/${String(id)}`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then((raw) => {
        if (!cancelled) setPresetMatches(parsePresetMatches(raw))
      })
      .catch(() => {
        if (!cancelled) setPresetMatches(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, presetsPath, apiRoute, refresh])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `pollTick` is a trigger-only dep — the poll loop bumps it.
  useEffect(() => {
    if (!prewarmPath || id == null) return
    let cancelled = false
    fetch(`${apiRoute}${prewarmPath}/${String(id)}`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then((raw) => {
        if (cancelled) return
        const next = parsePrewarmStatus(raw)
        setPrewarm(next)
        if (next?.status === 'queued' || next?.status === 'running') {
          prewarmActiveRef.current = true
          if (next.plan.length) lastPlanRef.current = next.plan
        } else if (prewarmActiveRef.current) {
          // A watched run just finished — hold the ghosts, pull in whatever it generated.
          prewarmActiveRef.current = false
          swappingRef.current = true
          setSwapping(true)
          setPage(1)
          setRefresh((r) => r + 1)
        }
      })
      .catch(() => {
        if (!cancelled) setPrewarm(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, prewarmPath, apiRoute, pollTick])

  // Poll only while a job is queued/running — a timeout chain, so idle costs nothing.
  useEffect(() => {
    const active = prewarm?.status === 'queued' || prewarm?.status === 'running'
    if (!active) return
    const t = setTimeout(() => setPollTick((n) => n + 1), 4000)
    return () => clearTimeout(t)
  }, [prewarm])

  const rowCount = fields?.presets?.rows?.length ?? 0
  const entries: RowEntry[] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const leaf = (key: string): unknown => fields[`presets.${rowIndex}.${key}`]?.value
    const str = (key: string): string | null => {
      const v = leaf(key)
      return typeof v === 'string' && v !== '' ? v : null
    }
    const num = (key: string): number | undefined => {
      const v = leaf(key)
      return typeof v === 'number' ? v : undefined
    }
    const ar = str('aspectRatio')
    const fit = str('fit')
    const fmt = str('format')
    return {
      rowIndex,
      template: str('template'),
      name: str('name'),
      width: num('width'),
      height: num('height'),
      aspectRatio: ar && isRatio(ar) ? ar : undefined,
      fit: fit && isFit(fit) ? fit : undefined,
      quality: num('quality'),
      format: fmt && isFormat(fmt) ? fmt : undefined,
    }
  })

  const customs = entries.filter(isCustom)
  // Template entries whose template was removed from the plugin config — surfaced so they can be deleted.
  const orphans = entries.filter((e) => e.template && !(e.template in templates))
  const takenNames = new Set<string>([...Object.keys(templates), ...customs.map((e) => e.name ?? '')])
  const activeTemplateRow = (name: string): RowEntry | undefined => entries.find((e) => e.template === name)

  const errors = validateDraft(draft, takenNames)
  const fieldErr = (k: keyof Draft | 'geometry'): string | undefined => (attempted ? errors[k] : undefined)

  const addEntry = (entry: PresetEntry): void => addFieldRow({ path: 'presets', schemaPath: 'presets', subFieldState: toSubFieldState(entry) })
  const removeEntry = (entry: RowEntry): void => removeFieldRow({ path: 'presets', rowIndex: entry.rowIndex })
  const toggleTemplate = (name: string): void => {
    const active = activeTemplateRow(name)
    if (active) removeEntry(active)
    else addEntry({ template: name })
  }

  const addCustom = (): void => {
    setAttempted(true)
    if (Object.keys(errors).length) return
    addEntry(draftToEntry(draft))
    setDraft(EMPTY_DRAFT)
    setAttempted(false)
  }

  const purge = async (): Promise<void> => {
    if (id == null || purging) return
    setPurging(true)
    try {
      const res = await fetch(`${apiRoute}${purgePath}/${id}`, { method: 'POST', credentials: 'include' })
      const raw: unknown = await res.json().catch(() => null)
      const json = typeof raw === 'object' && raw !== null ? raw : {}
      const errorMsg = 'error' in json && typeof json.error === 'string' ? json.error : undefined
      if (!res.ok) throw new Error(errorMsg || `HTTP ${res.status}`)
      const n = 'deleted' in json && typeof json.deleted === 'number' ? json.deleted : 0
      toast.success(`Purged ${n} generated image${n === 1 ? '' : 's'}.`)
      setPage(1)
      setRefresh((r) => r + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to purge variants.')
    } finally {
      setPurging(false)
    }
  }

  const triggerPrewarm = async (): Promise<void> => {
    if (!prewarmPath || id == null || prewarmBusy) return
    setPrewarmBusy(true)
    try {
      const res = await fetch(`${apiRoute}${prewarmPath}/${String(id)}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Prewarm queued.')
      // Covers the fast-job race: if the run finishes before the first poll, the idle response still refreshes.
      prewarmActiveRef.current = true
      setPollTick((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue the prewarm.')
    } finally {
      setPrewarmBusy(false)
    }
  }

  const deleteVariant = async (v: VariantRow): Promise<void> => {
    try {
      const res = await fetch(`${apiRoute}/${variantSlug}/${String(v.id)}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRefresh((r) => r + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete the variant.')
    }
  }

  const set =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  const presetUrl = (name: string): string | null => (id != null ? `${apiRoute}/img/${String(id)}?preset=${encodeURIComponent(name)}` : null)
  const variantUrl = (v: VariantRow): string | null => (v.filename ? `${apiRoute}/${variantSlug}/file/${encodeURIComponent(v.filename)}` : null)

  const copyLink = (path: string): void => {
    navigator.clipboard
      .writeText(`${window.location.origin}${path}`)
      .then(() => toast.success('Link copied.'))
      .catch(() => toast.error('Failed to copy the link.'))
  }

  // Open-in-tab + copy, sharing the link column.
  const linkCell = (path: string | null): React.ReactElement =>
    path ? (
      <span style={{ display: 'flex', justifyContent: 'center' }}>
        <a href={path} target="_blank" rel="noreferrer" style={{ ...iconBtn, textDecoration: 'none' }} title="Open in a new tab">
          ↗
        </a>
        <button type="button" style={iconBtn} title="Copy link" aria-label="Copy link" onClick={() => copyLink(path)}>
          ⧉
        </button>
      </span>
    ) : (
      <span />
    )

  // One <span> per data column so every row lines up under the header; values center under their label.
  const specCells = (spec: PresetSpec, dim: boolean): React.ReactElement[] => {
    const cell = (v: string | number | undefined, key: string): React.ReactElement => (
      <span key={key} style={{ ...(v == null ? emptyCell : cellText), justifySelf: 'center', ...(dim ? offStyle : {}) }}>
        {v ?? '—'}
      </span>
    )
    return [
      cell(spec.width, 'w'),
      cell(spec.height, 'h'),
      cell(typeof spec.aspectRatio === 'number' ? String(spec.aspectRatio) : spec.aspectRatio, 'ar'),
      cell(spec.fit, 'fit'),
      cell(spec.quality, 'q'),
      cell(spec.format, 'fmt'),
    ]
  }

  // Preset name plus, once its variant exists in the cache, that variant's id.
  const presetNameCell = (name: string, dim: boolean): React.ReactElement => {
    const match = presetMatches?.get(name)
    return (
      <span style={{ ...nameText, ...(dim ? offStyle : {}) }}>
        {name}
        {match?.variantId != null && (
          <span style={{ fontWeight: 400, color: 'var(--theme-elevation-500)' }} title={match.filename}>
            {' '}
            · #{String(match.variantId)}
          </span>
        )}
      </span>
    )
  }

  const templateRow = (name: string, spec: PresetSpec): React.ReactElement => {
    const on = !!activeTemplateRow(name)
    return (
      <div key={`t:${name}`} style={row}>
        {presetNameCell(name, !on)}
        {specCells(spec, !on)}
        {linkCell(presetUrl(name))}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${on ? 'Disable' : 'Enable'} eager generation of the ${name} preset`}
          title={on ? 'On — pre-generated on save' : 'Off — still servable, generated on first request'}
          style={toggleTrack(on)}
          onClick={() => toggleTemplate(name)}
        >
          <span style={toggleKnob(on)} />
        </button>
      </div>
    )
  }

  const deleteBtn = (entry: RowEntry): React.ReactElement => (
    <button type="button" style={iconBtn} title="Remove this preset" aria-label="Remove this preset" onClick={() => removeEntry(entry)}>
      ✕
    </button>
  )

  const customRow = (entry: RowEntry): React.ReactElement => (
    <div key={`c:${entry.name ?? entry.rowIndex}`} style={row}>
      {presetNameCell(entry.name ?? '?', false)}
      {specCells(entry, false)}
      {linkCell(entry.name ? presetUrl(entry.name) : null)}
      {deleteBtn(entry)}
    </div>
  )

  const orphanRow = (entry: RowEntry): React.ReactElement => (
    <div key={`o:${entry.template ?? entry.rowIndex}`} style={row}>
      <span style={nameText}>{entry.template}</span>
      <span style={{ ...cellText, gridColumn: '2 / 9', color: 'var(--theme-error-500, #d33)' }}>
        template no longer exists in the plugin config
      </span>
      {deleteBtn(entry)}
    </div>
  )

  const variantRow = (v: VariantRow): React.ReactElement => (
    <div key={`v:${v.id}`} style={row}>
      <span style={variantName} title={v.filename}>
        {v.filename ?? String(v.id)}
      </span>
      {specCells(
        {
          width: v.width,
          height: v.height,
          fit: v.fit && isFit(v.fit) ? v.fit : undefined,
          quality: v.quality,
          format: v.format && isFormat(v.format) ? v.format : undefined,
        },
        false,
      )}
      {linkCell(variantUrl(v))}
      <button
        type="button"
        style={iconBtn}
        title="Delete this cached variant — it regenerates on next request"
        aria-label="Delete this cached variant"
        onClick={() => void deleteVariant(v)}
      >
        ✕
      </button>
    </div>
  )

  // Planned-but-not-yet-generated targets from the pending prewarm run — ghost rows until the job lands them.
  const ghostRow = (p: PlanRow): React.ReactElement => (
    <div key={`g:${p.cacheKey}`} style={{ ...row, ...offStyle }}>
      <span style={variantName}>planned</span>
      {specCells(
        {
          width: p.w,
          height: p.h,
          fit: p.fit && isFit(p.fit) ? p.fit : undefined,
          quality: p.quality,
          format: p.format && isFormat(p.format) ? p.format : undefined,
        },
        true,
      )}
      <span />
      <span style={{ ...emptyCell, justifySelf: 'center' }}>queued</span>
    </div>
  )

  const draftInput = (k: keyof Draft, placeholder: string, opts?: { type?: string; title?: string }): React.ReactElement => (
    <input
      type={opts?.type ?? 'text'}
      inputMode={opts?.type === 'number' ? 'numeric' : undefined}
      min={opts?.type === 'number' ? 1 : undefined}
      style={{ ...inputStyle, ...(fieldErr(k) ? invalidInput : {}) }}
      placeholder={placeholder}
      title={opts?.title ?? placeholder}
      aria-label={opts?.title ?? placeholder}
      value={draft[k]}
      onChange={set(k)}
    />
  )

  const draftSelect = (k: keyof Draft, placeholder: string, options: readonly string[]): React.ReactElement => (
    <select
      style={{ ...inputStyle, cursor: 'pointer', ...(fieldErr(k) ? invalidInput : {}) }}
      title={placeholder}
      aria-label={placeholder}
      value={draft[k]}
      onChange={set(k)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )

  const totalPages = variants?.totalPages ?? 1
  const showPresetRows = page === 1
  // Preset-backed variants render on their preset's row, not as a second entry in the list.
  const presetVariantIds = new Set([...(presetMatches?.values() ?? [])].flatMap((m) => (m.variantId != null ? [String(m.variantId)] : [])))
  const listedVariants = (variants?.docs ?? []).filter((v) => !presetVariantIds.has(String(v.id)))
  const prewarmStatus = prewarm?.status ?? 'idle'
  const prewarmActive = prewarmStatus === 'queued' || prewarmStatus === 'running'
  const showPrewarmBtn = !!prewarmPath && id != null

  const statusLine = ((): string | null => {
    if (!prewarmPath || id == null) return null
    if (prewarmStatus === 'running') return 'Prewarm running…'
    if (prewarmStatus === 'queued') {
      const at = prewarm?.waitUntil ? new Date(prewarm.waitUntil) : null
      return at && at.getTime() > Date.now() ? `Prewarm queued · runs ${at.toLocaleTimeString()}` : 'Prewarm queued'
    }
    const lr = prewarm?.lastRun
    if (!lr) return null
    if (lr.skipped) return `Last prewarm skipped: ${lr.skipped}`
    return `Last prewarm: ${lr.generated ?? 0} generated, ${lr.failed ?? 0} failed`
  })()

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }}>Presets & variants</strong>
        <label style={limitWrap}>
          <span style={note}>Variant limit</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="default"
            title="Max cached variants before new sizes reuse a nearby existing one. Blank uses the project default. Presets never count."
            style={{ ...inputStyle, width: 76 }}
            value={typeof limitValue === 'number' ? String(limitValue) : ''}
            onChange={(e) => setLimitValue(e.target.value.trim() === '' ? null : Number(e.target.value))}
          />
        </label>
      </div>
      <p style={{ ...note, margin: `0.35rem 0 ${statusLine ? '0.2rem' : '0.75rem'}` }}>
        Presets are guaranteed variants — always servable at a stable URL, never capped; toggled-on ones are pre-generated on save. Below them:
        every cached variant generated on demand for this image, capped by the limit and purgeable at any time.
      </p>
      {statusLine && <p style={{ ...note, margin: '0 0 0.75rem', fontStyle: 'italic' }}>{statusLine}</p>}

      <div style={table}>
        <div style={headerRow}>
          {['Variant (ID or Preset Name)', 'Width', 'Height', 'Ratio', 'Fit', 'Quality', 'Format', 'Link'].map((label, i) => (
            <span key={label} style={{ ...headerCell, ...(i > 0 ? { justifySelf: 'center' } : {}) }}>
              {label}
            </span>
          ))}
          <span style={headerBtns}>
            {showPrewarmBtn && (
              <button
                type="button"
                disabled={prewarmBusy || prewarmStatus === 'running'}
                style={prewarmBtn(prewarmBusy || prewarmStatus === 'running')}
                title={
                  prewarmStatus === 'queued'
                    ? 'A prewarm is queued but nothing is scheduled to run it — run it now.'
                    : 'Queue a prewarm run now — generates the planned variants below without waiting for traffic.'
                }
                onClick={() => void triggerPrewarm()}
              >
                {prewarmStatus === 'running' ? 'Warming…' : prewarmStatus === 'queued' ? 'Run now' : 'Prewarm'}
              </button>
            )}
            {id != null && (variants?.totalDocs ?? 0) > 0 && (
              <button
                type="button"
                disabled={purging}
                style={purgeBtn(purging)}
                title="Delete every on-demand variant generated from this image — they regenerate on next request. Presets are untouched."
                onClick={() => void purge()}
              >
                {purging ? 'Purging…' : `Purge ${variants?.totalDocs ?? 0}`}
              </button>
            )}
          </span>
        </div>

        {showPresetRows && Object.entries(templates).map(([name, spec]) => templateRow(name, spec))}
        {showPresetRows && orphans.map(orphanRow)}
        {showPresetRows && customs.map(customRow)}
        {showPresetRows && (prewarmActive ? (prewarm?.plan ?? []) : swapping ? lastPlanRef.current : []).map(ghostRow)}
        {listedVariants.map(variantRow)}

        {totalPages > 1 && (
          <div style={{ ...row, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              style={pagerBtn(page > 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span style={{ ...note, fontVariantNumeric: 'tabular-nums' }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              style={pagerBtn(page < totalPages)}
              disabled={page >= totalPages}
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </div>
        )}

        <div style={row}>
          {draftInput('name', 'name', { title: 'Preset name (goes in the URL)' })}
          {draftInput('width', '1200', { type: 'number', title: 'Width px' })}
          {draftInput('height', '630', { type: 'number', title: 'Height px' })}
          {draftInput('aspectRatio', '16:9', { title: 'Aspect ratio' })}
          {draftSelect('fit', 'fit', FITS)}
          {draftInput('quality', '80', { type: 'number', title: 'Quality 1–100' })}
          {draftSelect('format', 'format', ENCODABLE_FORMATS)}
          <button type="button" style={{ ...addBtn, gridColumn: 'span 2' }} onClick={addCustom}>
            Add
          </button>
        </div>
      </div>
      {attempted && Object.keys(errors).length > 0 && (
        <p style={errText}>
          {[errors.name, errors.width, errors.height, errors.aspectRatio, errors.quality, errors.format, errors.geometry]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}
    </div>
  )
}

export default PresetManager

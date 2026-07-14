import type { Fit, OutputFormat, PresetEntry } from '../../../types'
import { ENCODABLE_FORMATS, FITS } from '../../../lib/transform/params'
import { PRESET_NAME_RE, PRESET_RATIO_RE } from '../../../lib/presets/validateEntries'

// Form fields store these unions as plain strings; validate before narrowing to the field type.
export const isFit = (v: string): v is Fit => FITS.some((f) => f === v)
export const isFormat = (v: string): v is OutputFormat => ENCODABLE_FORMATS.some((f) => f === v)
export const isRatio = (v: string): v is `${number}:${number}` => PRESET_RATIO_RE.test(v)

export const isCustom = (e: PresetEntry): boolean => !e.template && !!e.name

export type RowEntry = PresetEntry & { rowIndex: number }

export const toSubFieldState = (entry: PresetEntry): Record<string, { initialValue: unknown; valid: true; value: unknown }> =>
  Object.fromEntries(
    Object.entries(entry)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, { initialValue: v, valid: true, value: v }]),
  )

const isInt = (s: string): boolean => /^\d+$/.test(s.trim())

export type Draft = { name: string; width: string; height: string; aspectRatio: string; fit: string; quality: string; format: string }
export const EMPTY_DRAFT: Draft = { name: '', width: '', height: '', aspectRatio: '', fit: '', quality: '', format: '' }

// Mirrors the server-side field validation in lib/presets/validateEntries — same regexes, same rules,
// phrased for the form.
export const validateDraft = (d: Draft, takenNames: Set<string>): Partial<Record<keyof Draft | 'geometry', string>> => {
  const errs: Partial<Record<keyof Draft | 'geometry', string>> = {}
  const name = d.name.trim()
  if (!name) errs.name = 'Name is required.'
  else if (!PRESET_NAME_RE.test(name)) errs.name = 'Lowercase letters, digits, - or _ (it goes in the URL).'
  else if (takenNames.has(name)) errs.name = `“${name}” is already taken on this image.`
  if (d.width.trim() && !isInt(d.width)) errs.width = 'Width must be a whole number of pixels.'
  if (d.height.trim() && !isInt(d.height)) errs.height = 'Height must be a whole number of pixels.'
  if (d.aspectRatio.trim() && !PRESET_RATIO_RE.test(d.aspectRatio.trim())) errs.aspectRatio = 'Ratio must look like 16:9.'
  if (d.quality.trim() && (!isInt(d.quality) || Number(d.quality) < 1 || Number(d.quality) > 100)) errs.quality = 'Quality is 1–100.'
  if (!d.width.trim() && !d.height.trim() && !d.aspectRatio.trim()) errs.geometry = 'Give it a size: width, height, or an aspect ratio.'
  // Without a fixed format the preset URL content-negotiates (fmt=auto) and pre-generation only covers
  // webp — the "pre-generated, stable bytes" contract needs an explicit format.
  if (!isFormat(d.format)) errs.format = 'Pick a format — presets are pre-generated to one fixed file.'
  return errs
}

export const draftToEntry = (d: Draft): PresetEntry => {
  const ar = d.aspectRatio.trim()
  return {
    name: d.name.trim(),
    ...(d.width.trim() ? { width: Number(d.width) } : {}),
    ...(d.height.trim() ? { height: Number(d.height) } : {}),
    ...(isRatio(ar) ? { aspectRatio: ar } : {}),
    ...(isFit(d.fit) ? { fit: d.fit } : {}),
    ...(d.quality.trim() ? { quality: Number(d.quality) } : {}),
    ...(isFormat(d.format) ? { format: d.format } : {}),
  }
}

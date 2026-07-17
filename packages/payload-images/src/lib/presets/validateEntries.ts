import { isRecord } from '../../_kit'
import type { PresetSpec } from '../../types'
import { ENCODABLE_FORMATS, FITS } from '../transform/params'

export const PRESET_NAME_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
export const PRESET_RATIO_RE = /^\d+(\.\d+)?:\d+(\.\d+)?$/

const isPosInt = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v > 0

const entryErrors = (e: Record<string, unknown>, templates: Record<string, PresetSpec>): string[] => {
  const errs: string[] = []
  const template = typeof e.template === 'string' && e.template ? e.template : null
  const name = typeof e.name === 'string' && e.name ? e.name : null

  // A template entry is fully described by the plugin config — inline fields are ignored.
  if (template) {
    if (!(template in templates)) errs.push(`unknown template '${template}' (known: ${Object.keys(templates).join(', ') || 'none'})`)
    return errs
  }

  if (!name) errs.push('needs a name (or a template)')
  else if (!PRESET_NAME_RE.test(name)) errs.push(`name '${name}' must be lowercase letters/digits with - or _ (it goes in the URL)`)
  if (e.width != null && !isPosInt(e.width)) errs.push('width must be a positive integer')
  if (e.height != null && !isPosInt(e.height)) errs.push('height must be a positive integer')
  if (e.aspectRatio != null && !(typeof e.aspectRatio === 'string' && PRESET_RATIO_RE.test(e.aspectRatio)))
    errs.push('aspectRatio must look like 16:9')
  if (e.width == null && e.height == null && e.aspectRatio == null) errs.push('needs a width, height, or aspectRatio')
  if (e.fit != null && !FITS.some((f) => f === e.fit)) errs.push(`fit must be one of: ${FITS.join(', ')}`)
  if (e.quality != null && !(typeof e.quality === 'number' && Number.isInteger(e.quality) && e.quality >= 1 && e.quality <= 100))
    errs.push('quality must be an integer 1–100')
  // Without a fixed format the preset URL content-negotiates (fmt=auto) and pre-generation only
  // covers webp — the "pre-generated, stable bytes" contract needs an explicit format.
  if (!ENCODABLE_FORMATS.some((f) => f === e.format)) errs.push(`format is required (one of: ${ENCODABLE_FORMATS.join(', ')})`)
  return errs
}

/** Field-level validation for the presets array — holds seed/API writes to the same rules as the admin UI. */
export const validatePresetEntries = (value: unknown, templates: Record<string, PresetSpec>): true | string => {
  if (value == null || !Array.isArray(value)) return true
  const problems: string[] = []
  const seen = new Set<string>()
  value.forEach((raw, i) => {
    if (!isRecord(raw)) {
      problems.push(`presets[${i}]: must be an object`)
      return
    }
    const label = (typeof raw.template === 'string' && raw.template) || (typeof raw.name === 'string' && raw.name) || `#${i}`
    const servedName = label.startsWith('#') ? null : label
    if (servedName) {
      if (seen.has(servedName)) problems.push(`presets[${i}] ('${label}'): duplicate preset name`)
      seen.add(servedName)
    }
    problems.push(...entryErrors(raw, templates).map((e) => `presets[${i}] ('${label}'): ${e}`))
  })
  return problems.length ? problems.join(' • ') : true
}

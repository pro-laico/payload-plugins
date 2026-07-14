import type { PresetEntry, PresetSpec, QuerySource } from '../../types'

export const presetEntryName = (entry: PresetEntry): string | undefined => entry.template || entry.name || undefined

const inlineSpec = (entry: PresetEntry): PresetSpec => ({
  width: entry.width ?? undefined,
  height: entry.height ?? undefined,
  aspectRatio: entry.aspectRatio ?? undefined,
  fit: entry.fit ?? undefined,
  quality: entry.quality ?? undefined,
  format: entry.format ?? undefined,
})

export const resolvePreset = (
  entries: PresetEntry[] | null | undefined,
  templates: Record<string, PresetSpec> | undefined,
  name: string,
): PresetSpec | null => {
  if (!name || !Array.isArray(entries)) return null
  const entry = entries.find((e) => presetEntryName(e) === name)
  if (!entry) return null
  if (entry.template) return templates?.[entry.template] ?? null
  return inlineSpec(entry)
}

export const presetQuery = (spec: PresetSpec): QuerySource | null => {
  if (spec.width == null && spec.height == null && spec.aspectRatio == null) return null
  const q: Record<string, string> = {}
  if (spec.width != null) q.w = String(spec.width)
  if (spec.height != null) q.h = String(spec.height)
  if (spec.aspectRatio != null) q.ar = String(spec.aspectRatio)
  if (spec.fit != null) q.fit = spec.fit
  if (spec.quality != null) q.q = String(spec.quality)
  if (spec.format != null) q.fmt = spec.format
  return q
}

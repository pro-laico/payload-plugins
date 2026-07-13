/**
 * Resolve a named preset for one image to a concrete spec, then to the endpoint's query shape.
 * Pure — the transform endpoint (serving `?preset=name`) and the eager-generation hook share it.
 * A template entry (`{ template }`) resolves against the plugin's config templates so a config
 * edit propagates to every image; a custom entry (`{ name, ...spec }`) carries its own spec.
 */
import type { PresetEntry, PresetSpec, QuerySource } from '../../types'

/** The public name of an entry — the template it references, else its custom name. */
export const presetEntryName = (entry: PresetEntry): string | undefined => entry.template || entry.name || undefined

const inlineSpec = (entry: PresetEntry): PresetSpec => ({
  width: entry.width ?? undefined,
  height: entry.height ?? undefined,
  aspectRatio: entry.aspectRatio ?? undefined,
  fit: entry.fit ?? undefined,
  quality: entry.quality ?? undefined,
  format: entry.format ?? undefined,
})

/** The spec for `name` among an image's entries, or null when no active preset matches. */
export const resolvePreset = (
  entries: PresetEntry[] | null | undefined,
  templates: Record<string, PresetSpec> | undefined,
  name: string,
): PresetSpec | null => {
  if (!name || !Array.isArray(entries)) return null
  const entry = entries.find((e) => presetEntryName(e) === name)
  if (!entry) return null
  if (entry.template) return templates?.[entry.template] ?? null // template ref → config spec (DRY)
  return inlineSpec(entry)
}

/** A resolved spec as the endpoint's query record, so it runs through `parseTransformParams`
 *  (same clamp / snap / validation as an organic request). A spec with neither width nor height
 *  nor ratio can't produce a variant → null. */
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

/**
 * afterChange on the source → eagerly generate the image's active presets so a version always
 * physically exists (cold crawlers, OG). Fires on create and on a variant-identity change (file /
 * focal / hotspot — the same trigger set that purges), so presets re-materialize with the new
 * crop. Cache-deduped, so a metadata-only save is cheap. Best-effort/logged and non-blocking:
 * deferred via `after()` in a request, run inline otherwise (seed / CLI). Never blocks the write.
 */
import { after } from 'next/server'
import type { CollectionAfterChangeHook, Payload } from 'payload'

import { getServerSideURL } from '../../lib/getServerSideURL'
import { getOrCreateVariantBytes } from '../../lib/transform/getVariantBytes'
import { parseTransformParams } from '../../lib/transform/params'
import { resolveConstraints } from '../../endpoints/transform/config'
import { presetEntryName, presetQuery, resolvePreset } from '../../lib/presets/resolve'
import { detectVariantIdentityChange } from './variantIdentity'
import type { PresetEntry, PresetTemplate, SourceDoc, TransformConstraints, VariantSourceDoc } from '../../types'

export interface GeneratePresetsOptions {
  sourceSlug: string
  variantSlug: string
  templates: Record<string, PresetTemplate>
  constraints: TransformConstraints
}

const generateActivePresets = async (payload: Payload, src: SourceDoc, opts: GeneratePresetsOptions): Promise<void> => {
  const entries = Array.isArray(src.presets) ? (src.presets as PresetEntry[]) : []
  if (!entries.length || (!src.filename && !src.url)) return
  const base = payload.config.serverURL || getServerSideURL()
  for (const entry of entries) {
    const name = presetEntryName(entry)
    if (!name) continue
    const spec = resolvePreset(entries, opts.templates, name)
    const query = spec && presetQuery(spec)
    if (!query) continue
    // Exact dimensions (no snap) so the pre-generated variant shares the endpoint's preset cache key.
    const parsed = parseTransformParams(query, { ...opts.constraints, dimensionStep: 1 })
    if (!parsed.ok) continue
    const format = parsed.params.fmt === 'auto' ? 'webp' : parsed.params.fmt
    try {
      await getOrCreateVariantBytes({
        payload,
        source: src as VariantSourceDoc,
        params: parsed.params,
        format,
        sourceSlug: opts.sourceSlug,
        variantSlug: opts.variantSlug,
        base,
        maxInputPixels: opts.constraints.maxInputPixels,
        deferPersist: false,
      })
    } catch (err) {
      payload.logger.warn(`[payload-images] preset '${name}' generation failed for source ${src.id}: ${String(err)}`)
    }
  }
}

export const generatePresetsAfterChange = (opts: GeneratePresetsOptions): CollectionAfterChangeHook => {
  return ({ doc, previousDoc, operation, req }) => {
    try {
      const presetsChanged = JSON.stringify(previousDoc?.presets ?? null) !== JSON.stringify(doc?.presets ?? null)
      const fire = operation === 'create' || presetsChanged || detectVariantIdentityChange(previousDoc, doc).any
      if (!fire) return doc
      const work = (): Promise<void> => generateActivePresets(req.payload, doc as SourceDoc, opts) //EXCUSE: hook doc is untyped; generateActivePresets duck-checks every field
      try {
        after(work)
      } catch {
        void work() // non-Next runtime (seed / CLI)
      }
    } catch (err) {
      req.payload.logger.warn(`[payload-images] preset generation hook failed for ${doc?.id}: ${String(err)}`)
    }
    return doc
  }
}

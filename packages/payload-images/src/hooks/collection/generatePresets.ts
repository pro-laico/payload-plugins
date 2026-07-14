import { after } from 'next/server'
import type { CollectionAfterChangeHook, Payload } from 'payload'

import { getServerSideURL } from '../../lib/getServerSideURL'
import { detectVariantIdentityChange } from './variantIdentity'
import { parseTransformParams } from '../../lib/transform/params'
import { resolveConstraints } from '../../endpoints/transform/config'
import { getOrCreateVariantBytes } from '../../lib/transform/getVariantBytes'
import { presetEntryName, presetQuery, resolvePreset } from '../../lib/presets/resolve'
import type { PresetEntry, PresetSpec, SourceDoc, TransformConstraints, VariantSourceDoc } from '../../types'

export interface GeneratePresetsOptions {
  sourceSlug: string
  variantSlug: string
  templates: Record<string, PresetSpec>
  constraints: TransformConstraints
}

const generateActivePresets = async (payload: Payload, src: SourceDoc, opts: GeneratePresetsOptions): Promise<void> => {
  const entries = Array.isArray(src.presets) ? (src.presets as PresetEntry[]) : [] //TODO: replace `as` cast with proper typing
  if (!entries.length || (!src.filename && !src.url)) return
  const base = payload.config.serverURL || getServerSideURL()
  for (const entry of entries) {
    const name = presetEntryName(entry)
    if (!name) continue
    const spec = resolvePreset(entries, opts.templates, name)
    const query = spec && presetQuery(spec)
    if (!query) continue
    const parsed = parseTransformParams(query, { ...opts.constraints, dimensionStep: 1 })
    if (!parsed.ok) continue
    const format = parsed.params.fmt === 'auto' ? 'webp' : parsed.params.fmt
    try {
      await getOrCreateVariantBytes({
        payload,
        source: src as VariantSourceDoc, //TODO: replace `as` cast with proper typing
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
      const work = (): Promise<void> => generateActivePresets(req.payload, doc as SourceDoc, opts) //TODO: replace `as` cast with proper typing
      try {
        after(work)
      } catch {
        void work()
      }
    } catch (err) {
      req.payload.logger.warn(`[payload-images] preset generation hook failed for ${doc?.id}: ${String(err)}`)
    }
    return doc
  }
}

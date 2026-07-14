import type { Endpoint, PayloadRequest } from 'payload'

import { asSlug } from '../../lib/asSlug'
import { isRecord } from '../../lib/isRecord'
import { guardSourceRequest } from '../guardSource'
import { variantCacheKey } from '../../lib/transform/variantKey'
import { parseTransformParams } from '../../lib/transform/params'
import { presetEntryName, presetQuery, resolvePreset } from '../../lib/presets/resolve'
import type { CacheKeyDoc, PresetEntry, PresetSpec, PresetStatusResponse, PresetVariantMatch, TransformConstraints } from '../../types'

export interface PresetStatusEndpointConfig {
  sourceSlug: string
  variantSlug: string
  templates: Record<string, PresetSpec>
  constraints: TransformConstraints
}

// The plugin owns the image collection's schema but can't name its app-generated type.
const isPresetEntry = (v: unknown): v is PresetEntry => isRecord(v)

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

const toCacheKeyDoc = (raw: Record<string, unknown>, id: string): CacheKeyDoc => ({
  id,
  filename: typeof raw.filename === 'string' ? raw.filename : null,
  focalX: num(raw.focalX),
  focalY: num(raw.focalY),
  focalSize: num(raw.focalSize),
  cropLeft: num(raw.cropLeft),
  cropTop: num(raw.cropTop),
  cropRight: num(raw.cropRight),
  cropBottom: num(raw.cropBottom),
})

/** Maps every servable preset (config templates + custom entries) to its cacheKey and, when cached, its variant. */
export const createPresetStatusEndpoint = (cfg: PresetStatusEndpointConfig): Endpoint => ({
  path: '/img/presets/:id',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const guarded = await guardSourceRequest(req, cfg.sourceSlug)
    if (guarded instanceof Response) return guarded
    const { id, doc: raw } = guarded
    if (!isRecord(raw)) return Response.json({ error: 'Not found' }, { status: 404 })

    try {
      const src = toCacheKeyDoc(raw, id)
      const entries = Array.isArray(raw.presets) ? raw.presets.filter(isPresetEntry) : []
      const names = [...new Set([...Object.keys(cfg.templates), ...entries.map(presetEntryName).filter((n): n is string => !!n)])]

      // Preset name → the cacheKey its URL resolves to, replaying the serve path exactly
      // (dimensionStep 1, auto → webp like eager generation).
      const keyed = names.flatMap((name): { name: string; cacheKey: string }[] => {
        const spec = resolvePreset(entries, cfg.templates, name)
        const query = spec && presetQuery(spec)
        if (!query) return []
        const parsed = parseTransformParams(query, { ...cfg.constraints, dimensionStep: 1 })
        if (!parsed.ok) return []
        const format = parsed.params.fmt === 'auto' ? 'webp' : parsed.params.fmt
        return [{ name, cacheKey: variantCacheKey(src, parsed.params, format) }]
      })

      const found = keyed.length
        ? await req.payload.find({
            collection: asSlug(cfg.variantSlug),
            where: { and: [{ source: { equals: id } }, { cacheKey: { in: keyed.map((k) => k.cacheKey) } }] },
            select: { cacheKey: true, filename: true },
            limit: keyed.length,
            depth: 0,
          })
        : { docs: [] }
      const byKey = new Map(
        found.docs.flatMap((d): [string, { id: string | number; filename?: string }][] => {
          if (!isRecord(d) || typeof d.cacheKey !== 'string') return []
          const variantId = typeof d.id === 'string' || typeof d.id === 'number' ? d.id : null
          if (variantId == null) return []
          return [[d.cacheKey, { id: variantId, ...(typeof d.filename === 'string' ? { filename: d.filename } : {}) }]]
        }),
      )

      const body: PresetStatusResponse = {
        presets: keyed.map((k): PresetVariantMatch => {
          const match = byKey.get(k.cacheKey)
          return { ...k, ...(match ? { variantId: match.id, ...(match.filename ? { filename: match.filename } : {}) } : {}) }
        }),
      }
      return Response.json(body)
    } catch (err) {
      req.payload.logger.error(`[payload-images] preset status failed for ${id}: ${String(err)}`)
      return Response.json({ error: 'Preset status failed' }, { status: 500 })
    }
  },
})

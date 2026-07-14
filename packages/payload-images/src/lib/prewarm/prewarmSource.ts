import type { CollectionSlug, Payload } from 'payload'

import { asSlug } from '../asSlug'
import { isRecord } from '../isRecord'
import { readBytes } from '../transform/source'
import { getServerSideURL } from '../getServerSideURL'
import { IMAGE_MIME_TYPES } from '../transform/params'
import { computePrewarmTargets } from './computeTargets'
import { resolveStaticDir } from '../transform/staticDir'
import { getOrCreateVariantBytes } from '../transform/getVariantBytes'
import type {
  OutputFormat,
  PrewarmSourceResult,
  PrewarmTarget,
  RenderProfileDoc,
  RenderProfileSeed,
  TransformConstraints,
  VariantSourceDoc,
} from '../../types'

export interface PrewarmSourceDeps {
  sourceSlug: string
  variantSlug: string
  profilesSlug: string
  seeds: RenderProfileSeed[]
  formats: OutputFormat[]
  maxVariantsPerImage: number
  constraints: TransformConstraints
}

export type SourceRow = VariantSourceDoc & { width?: number | null; height?: number | null; mimeType?: string | null }

/** The dry-run half of a prewarm: which variants WOULD be generated. Shared by the job handler and the status endpoint. */
export type PrewarmPlan = { ok: true; source: SourceRow; targets: PrewarmTarget[] } | { ok: false; skipped: 'missing' | 'non-raster' }

// The plugin owns these collections' schemas but can't name their app-generated types; a light id check
// confirms a real row, and the local shape describes the fields the plugin wrote.
const isSourceRow = (v: unknown): v is SourceRow => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')
const isRenderProfileDoc = (v: unknown): v is RenderProfileDoc => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')

const existingCacheKeys = async (payload: Payload, variantSlug: CollectionSlug, sourceId: string | number): Promise<Set<string>> => {
  const keys = new Set<string>()
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: variantSlug,
      where: { source: { equals: sourceId } },
      select: { cacheKey: true },
      limit: 100,
      page,
      depth: 0,
    })
    for (const doc of res.docs) {
      const key = isRecord(doc) ? doc.cacheKey : undefined
      if (typeof key === 'string' && key) keys.add(key)
    }
    if (!res.hasNextPage) break
    page++
  }
  return keys
}

export const loadPrewarmPlan = async (payload: Payload, sourceId: string | number, deps: PrewarmSourceDeps): Promise<PrewarmPlan> => {
  const sourceSlug = asSlug(deps.sourceSlug)
  const variantSlug = asSlug(deps.variantSlug)
  const profilesSlug = asSlug(deps.profilesSlug)

  const raw = await payload.findByID({ collection: sourceSlug, id: sourceId, depth: 0, disableErrors: true })
  const source = isSourceRow(raw) ? raw : null
  if (!source || (!source.filename && !source.url)) return { ok: false, skipped: 'missing' }
  if (typeof source.mimeType === 'string' && !IMAGE_MIME_TYPES.includes(source.mimeType)) return { ok: false, skipped: 'non-raster' }

  const profiles = (await payload.find({ collection: profilesSlug, limit: 100, sort: '-hitCount', depth: 0 })).docs.filter(isRenderProfileDoc)

  const targets = computePrewarmTargets({
    source,
    profiles,
    seeds: deps.seeds,
    formats: deps.formats,
    constraints: deps.constraints,
    existingKeys: await existingCacheKeys(payload, variantSlug, source.id),
    maxVariantsPerImage: deps.maxVariantsPerImage,
  })
  return { ok: true, source, targets }
}

export const prewarmSource = async (payload: Payload, sourceId: string | number, deps: PrewarmSourceDeps): Promise<PrewarmSourceResult> => {
  const plan = await loadPrewarmPlan(payload, sourceId, deps)
  if (!plan.ok) return { targets: 0, generated: 0, failed: 0, skipped: plan.skipped }
  const { source, targets } = plan
  const sourceSlug = asSlug(deps.sourceSlug)

  const base = payload.config.serverURL || getServerSideURL()
  const originalBytes = targets.length
    ? ((await readBytes(source, resolveStaticDir(payload, sourceSlug), base, { payload, slug: deps.sourceSlug })) ?? undefined)
    : undefined
  let generated = 0
  let failed = 0
  for (const target of targets) {
    try {
      const res = await getOrCreateVariantBytes({
        payload,
        source,
        params: target.params,
        format: target.format,
        sourceSlug: deps.sourceSlug,
        variantSlug: deps.variantSlug,
        base,
        maxInputPixels: deps.constraints.maxInputPixels,
        deferPersist: false,
        originalBytes,
      })
      if (res.ok) generated++
      else failed++
    } catch {
      failed++
    }
  }
  return { targets: targets.length, generated, failed }
}

/**
 * Warm one source: load it + the profile registry + the already-generated cacheKeys, compute the
 * bounded target list, and generate each variant through the same engine the endpoint uses —
 * sequentially (the Sharp FIFO gate owns real concurrency; sequential keeps job memory flat),
 * with an awaited persist (no request to defer behind). Idempotent: a retry recomputes and only
 * redoes what's still missing.
 */
import type { CollectionSlug, Payload } from 'payload'

import { getServerSideURL } from '../getServerSideURL'
import { getOrCreateVariantBytes } from '../transform/getVariantBytes'
import { readBytes } from '../transform/source'
import { resolveStaticDir } from '../transform/staticDir'
import { IMAGE_MIME_TYPES } from '../transform/params'
import { computePrewarmTargets } from './computeTargets'
import type {
  OutputFormat,
  PrewarmSourceResult,
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

type SourceRow = VariantSourceDoc & { width?: number | null; height?: number | null; mimeType?: string | null }

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
      overrideAccess: true,
    })
    for (const doc of res.docs) {
      const key = (doc as { cacheKey?: unknown }).cacheKey //EXCUSE: docs of a runtime-configured collection are untyped; string-guarded below
      if (typeof key === 'string' && key) keys.add(key)
    }
    if (!res.hasNextPage) break
    page++
  }
  return keys
}

export const prewarmSource = async (payload: Payload, sourceId: string | number, deps: PrewarmSourceDeps): Promise<PrewarmSourceResult> => {
  const sourceSlug = deps.sourceSlug as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
  const variantSlug = deps.variantSlug as CollectionSlug //EXCUSE: same as sourceSlug above
  const profilesSlug = deps.profilesSlug as CollectionSlug //EXCUSE: same as sourceSlug above

  const raw = await payload.findByID({ collection: sourceSlug, id: sourceId, depth: 0, overrideAccess: true, disableErrors: true })
  const source = (raw ?? null) as SourceRow | null //EXCUSE: a doc of a runtime-configured collection is untyped; fields are null-guarded
  if (!source || (!source.filename && !source.url)) return { targets: 0, generated: 0, failed: 0, skipped: 'missing' }
  if (typeof source.mimeType === 'string' && !IMAGE_MIME_TYPES.includes(source.mimeType))
    return { targets: 0, generated: 0, failed: 0, skipped: 'non-raster' }

  const profiles = (await payload.find({ collection: profilesSlug, limit: 100, sort: '-hitCount', depth: 0, overrideAccess: true }))
    .docs as unknown as RenderProfileDoc[] //EXCUSE: docs of a runtime-configured collection are untyped; compute null-guards every field

  const targets = computePrewarmTargets({
    source,
    profiles,
    seeds: deps.seeds,
    formats: deps.formats,
    constraints: deps.constraints,
    existingKeys: await existingCacheKeys(payload, variantSlug, source.id),
    maxVariantsPerImage: deps.maxVariantsPerImage,
  })

  const base = payload.config.serverURL || getServerSideURL()
  // Read the original ONCE for the whole job (default up to 24 variants) instead of per target.
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

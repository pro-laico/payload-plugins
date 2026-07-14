import type { CollectionSlug, Payload } from 'payload'

import { asSlug } from '../asSlug'
import { readBytes } from '../transform/source'
import { getServerSideURL } from '../getServerSideURL'
import { IMAGE_MIME_TYPES } from '../transform/params'
import { computePrewarmTargets } from './computeTargets'
import { resolveStaticDir } from '../transform/staticDir'
import { getOrCreateVariantBytes } from '../transform/getVariantBytes'
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
    })
    for (const doc of res.docs) {
      const key = (doc as { cacheKey?: unknown }).cacheKey //TODO: replace `as` cast with proper typing
      if (typeof key === 'string' && key) keys.add(key)
    }
    if (!res.hasNextPage) break
    page++
  }
  return keys
}

export const prewarmSource = async (payload: Payload, sourceId: string | number, deps: PrewarmSourceDeps): Promise<PrewarmSourceResult> => {
  const sourceSlug = asSlug(deps.sourceSlug)
  const variantSlug = asSlug(deps.variantSlug)
  const profilesSlug = asSlug(deps.profilesSlug)

  const raw = await payload.findByID({ collection: sourceSlug, id: sourceId, depth: 0, disableErrors: true })
  const source = (raw ?? null) as SourceRow | null //TODO: replace `as` cast with proper typing
  if (!source || (!source.filename && !source.url)) return { targets: 0, generated: 0, failed: 0, skipped: 'missing' }
  if (typeof source.mimeType === 'string' && !IMAGE_MIME_TYPES.includes(source.mimeType))
    return { targets: 0, generated: 0, failed: 0, skipped: 'non-raster' }

  const profiles = (await payload.find({ collection: profilesSlug, limit: 100, sort: '-hitCount', depth: 0 }))
    .docs as unknown as RenderProfileDoc[] //TODO: replace `as` cast with proper typing

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

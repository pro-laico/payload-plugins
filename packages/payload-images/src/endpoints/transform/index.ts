import { after } from 'next/server'
import type { Endpoint, PayloadRequest } from 'payload'

import { routeId } from '../routeId'
import { asSlug } from '../../lib/asSlug'
import { readSourceDoc } from './sourceDoc'
import { resolveConstraints } from './config'
import { createSingleFlight } from './coalesce'
import { readBytes } from '../../lib/transform/source'
import { getServerSideURL } from '../../lib/getServerSideURL'
import { resolveStaticDir } from '../../lib/transform/staticDir'
import { presetQuery, resolvePreset } from '../../lib/presets/resolve'
import { setTransformConcurrency } from '../../lib/transform/limit'
import { setSharpConcurrency } from '../../lib/transform/sharpInstance'
import { buildFallbackHeaders, buildHeaders, toBody } from './response'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { countVariantsForSource } from '../../lib/transform/variantCount'
import { classifyRatio, type RatioCandidate } from '../../lib/prewarm/profileKey'
import { effectiveRequestWidth, FALLBACK_MIN_WIDTH_RATIO, pickFallbackVariant } from '../../lib/transform/fallback'
import { createObservationRecorder, type ObservationRecorder } from '../../lib/prewarm/recorder'
import { getCachedVariantBytes, generateVariantBytes } from '../../lib/transform/getVariantBytes'
import { mimeForFormat, negotiateFormat, parseTransformParams } from '../../lib/transform/params'
import { isRecord } from '../../lib/isRecord'
import type { FallbackCandidate, OutputFormat, ParsedParams, SourceDoc, TransformEndpointArgs } from '../../types'

const isFallbackCandidate = (v: unknown): v is FallbackCandidate => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')

export type { TransformEndpointConfig } from '../../types'

export interface PrewarmObserveConfig {
  profilesSlug: string
  seedCandidates: RatioCandidate[]
}

export const createTransformEndpoint = (cfg: TransformEndpointArgs, prewarmObserve?: PrewarmObserveConfig): Endpoint => {
  const fallback = cfg.fallback !== false
  const cdn = cfg.cdnCacheControl !== false
  const constraints = resolveConstraints(cfg)
  const sourceSlug = asSlug(cfg.sourceSlug || 'images')
  const variantSlug = asSlug(cfg.variantSlug || GENERATED_IMAGES_SLUG)

  setSharpConcurrency(cfg.sharpConcurrency)
  setTransformConcurrency(cfg.maxConcurrency)

  let recorder: ObservationRecorder | undefined
  const sourceFlight = createSingleFlight<string, SourceDoc | null>()

  return {
    path: '/img/:id',
    method: 'get',
    handler: async (req: PayloadRequest): Promise<Response> => {
      const { payload } = req
      const base = payload.config.serverURL || getServerSideURL()

      const id = routeId(req)
      if (!id) return new Response('Missing target collections id', { status: 400 })

      const presetName = req.searchParams?.get('preset') ?? null

      let source = await sourceFlight(id, () => readSourceDoc(payload, sourceSlug, id, null))
      const isPublic = source != null
      if (!source && req.user) source = await readSourceDoc(payload, sourceSlug, id, req.user)
      if (!source || (!source.url && !source.filename)) return new Response('Not found', { status: 404 })
      const src = source

      let p: ParsedParams
      let isPreset = false
      if (presetName) {
        const spec = resolvePreset(src.presets, cfg.presetTemplates, presetName)
        const query = spec && presetQuery(spec)
        if (!query) return new Response('Unknown preset', { status: 404 })
        const parsed = parseTransformParams(query, { ...constraints, dimensionStep: 1 })
        if (!parsed.ok) return new Response(parsed.error, { status: 400 })
        p = parsed.params
        isPreset = true
      } else {
        const parsed = parseTransformParams(req.searchParams ?? new URLSearchParams(), constraints)
        if (!parsed.ok) return new Response(parsed.error, { status: 400 })
        p = parsed.params
      }

      const isAuto = p.fmt === 'auto'
      const format: OutputFormat =
        p.fmt === 'auto' ? negotiateFormat(req.headers.get('accept'), constraints.formats, constraints.preferAvif) : p.fmt

      const engineArgs = {
        payload,
        source: src,
        params: p,
        format,
        sourceSlug,
        variantSlug,
        base,
        maxInputPixels: constraints.maxInputPixels,
      }
      let result = await getCachedVariantBytes(engineArgs)

      let standIn: { data: Buffer; mimeType: string } | null = null
      if (!result && fallback && p.w != null) {
        try {
          const effectiveW = effectiveRequestWidth(p, src)
          const rows = await payload.find({
            collection: variantSlug,
            where: {
              and: [
                { source: { equals: src.id } },
                { fit: { equals: p.fit } },
                { width: { greater_than_equal: Math.ceil(FALLBACK_MIN_WIDTH_RATIO * effectiveW) } },
                ...(format !== 'avif' ? [{ format: { not_equals: 'avif' } }] : []),
              ],
            },
            sort: '-width',
            limit: 24,
            depth: 0,
            select: {
              width: true,
              height: true,
              fit: true,
              format: true,
              quality: true,
              windowed: true,
              mimeType: true,
              focalX: true,
              focalY: true,
              filename: true,
              url: true,
              prefix: true,
            },
          })
          const candidates = rows.docs.flatMap((d) => (isFallbackCandidate(d) ? [d] : []))
          const pick = pickFallbackVariant(p, format, src, candidates, constraints)
          if (pick) {
            const bytes = await readBytes(pick, resolveStaticDir(payload, variantSlug), base, { payload, slug: variantSlug })
            if (bytes) {
              standIn = { data: bytes, mimeType: pick.mimeType ?? mimeForFormat(format) }
              const work = (): Promise<unknown> => generateVariantBytes({ ...engineArgs, deferPersist: false }).catch(() => undefined)
              try {
                after(work)
              } catch {
                void work()
              }
            }
          }
        } catch {}
      }
      if (!result && !standIn) {
        const limit = src.variantLimit ?? cfg.variantLimit
        const overCap = !isPreset && limit >= 0 && (await countVariantsForSource(payload, variantSlug, src.id)) >= limit
        result = await generateVariantBytes(overCap ? { ...engineArgs, deferPersist: 'never' } : engineArgs)
      }

      if (result && !result.ok) {
        const headers = result.status === 503 ? { 'Retry-After': '2', 'Cache-Control': 'no-store' } : undefined
        return new Response(result.msg, { status: result.status, headers })
      }

      if (prewarmObserve) {
        recorder ??= createObservationRecorder({
          payload,
          profilesSlug: prewarmObserve.profilesSlug,
          seedCandidates: prewarmObserve.seedCandidates,
        })
        const ratio = classifyRatio({
          w: p.w,
          h: p.h,
          sourceW: src.width,
          sourceH: src.height,
          candidates: recorder.knownRatios(),
          constraints,
        })
        recorder.observe({ parts: { ratio, fit: p.fit, quality: p.q, format: p.fmt }, width: p.w })
      }

      if (standIn) return new Response(toBody(standIn.data), { headers: buildFallbackHeaders(standIn.mimeType, isAuto, cdn) })
      if (!result) return new Response('Not found', { status: 404 })
      return new Response(toBody(result.data), { headers: buildHeaders(result.mimeType, result.key, isAuto, cdn, isPublic) })
    },
  }
}

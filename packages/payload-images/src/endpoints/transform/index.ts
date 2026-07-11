/**
 * The on-demand image transform endpoint (settings in the URL), mounted at `/api/img/...`.
 * Same-origin: streams bytes, never redirects to the storage host. On a miss it transforms with
 * Sharp, responds immediately, and persists the variant after the response. Config-level
 * endpoints are only consulted when the first path segment isn't a collection/global slug — so
 * `/img` is safe as long as no collection is named `img` (the plugin warns at boot).
 */
import { after } from 'next/server'
import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { routeId } from '../routeId'
import { getServerSideURL } from '../../lib/getServerSideURL'
import { setTransformConcurrency } from '../../lib/transform/limit'
import { setSharpConcurrency } from '../../lib/transform/sharpInstance'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { getCachedVariantBytes, generateVariantBytes } from '../../lib/transform/getVariantBytes'
import { mimeForFormat, negotiateFormat, parseTransformParams } from '../../lib/transform/params'
import { pickFallbackVariant } from '../../lib/transform/fallback'
import { resolveStaticDir } from '../../lib/transform/staticDir'
import { readBytes } from '../../lib/transform/source'
import { classifyRatio, type RatioCandidate } from '../../lib/prewarm/profileKey'
import { createObservationRecorder, type ObservationRecorder } from '../../lib/prewarm/recorder'
import type { FallbackCandidate, GenBytes, OutputFormat, SourceDoc, TransformEndpointConfig } from '../../types'

import { createSingleFlight } from './coalesce'
import { buildFallbackHeaders, buildHeaders, toBody } from './response'
import { resolveConstraints } from './config'
import { readSourceDoc } from './sourceDoc'

export type { TransformEndpointConfig } from '../../types'

/** Prewarm's observation wiring — present only when the plugin's `prewarm` option is on. */
export interface PrewarmObserveConfig {
  profilesSlug: string
  seedCandidates: RatioCandidate[]
}

/** GET `/img/:id?w&h&ar&fit&q&fmt` — on-demand transform with focal-aware crop. */
export const createTransformEndpoint = (cfg: TransformEndpointConfig = {}, prewarmObserve?: PrewarmObserveConfig): Endpoint => {
  const sourceSlug = (cfg.sourceSlug || 'images') as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
  const variantSlug = (cfg.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug //EXCUSE: same as sourceSlug above
  const cdn = cfg.cdnCacheControl !== false
  const fallback = cfg.fallback !== false
  const constraints = resolveConstraints(cfg)
  setTransformConcurrency(cfg.maxConcurrency)
  setSharpConcurrency(cfg.sharpConcurrency)

  const sourceFlight = createSingleFlight<string, SourceDoc | null>()
  const genFlight = createSingleFlight<string, GenBytes>()
  let recorder: ObservationRecorder | undefined

  return {
    path: '/img/:id',
    method: 'get',
    handler: async (req: PayloadRequest): Promise<Response> => {
      const { payload } = req
      const base = payload.config.serverURL || getServerSideURL()

      const id = routeId(req)
      if (!id) return new Response('Missing target collections id', { status: 400 })

      const parsed = parseTransformParams(req.searchParams ?? new URLSearchParams(), constraints)
      if (!parsed.ok) return new Response(parsed.error, { status: 400 })
      const p = parsed.params

      let source = await sourceFlight(id, () => readSourceDoc(payload, sourceSlug, id, null))
      const isPublic = source != null
      if (!source && req.user) source = await readSourceDoc(payload, sourceSlug, id, req.user)
      if (!source || (!source.url && !source.filename)) return new Response('Not found', { status: 404 })
      const src = source

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
        genFlight,
      }
      let result = await getCachedVariantBytes(engineArgs)

      // Cache miss with a nearby variant ready → serve the stand-in NOW (never cached: no-store)
      // and generate the exact variant in the background; the next request gets the exact one.
      let standIn: { data: Buffer; mimeType: string } | null = null
      if (!result && fallback) {
        try {
          const rows = await payload.find({
            collection: variantSlug,
            where: { source: { equals: src.id } },
            limit: 100,
            depth: 0,
            overrideAccess: true,
            select: {
              width: true,
              height: true,
              fit: true,
              format: true,
              quality: true,
              mimeType: true,
              filename: true,
              url: true,
              prefix: true,
            },
          })
          const pick = pickFallbackVariant(p, format, src, rows.docs as FallbackCandidate[], constraints) //EXCUSE: docs of a runtime-configured collection are untyped; the picker null-guards every field
          if (pick) {
            const bytes = await readBytes(pick, resolveStaticDir(payload, variantSlug), base, { payload, slug: variantSlug })
            if (bytes) {
              standIn = { data: bytes, mimeType: pick.mimeType ?? mimeForFormat(format) }
              const work = (): Promise<unknown> => generateVariantBytes({ ...engineArgs, deferPersist: false }).catch(() => undefined) // the engine logs its own failures
              try {
                after(work)
              } catch {
                void work() // non-Next runtime (tests/CLI)
              }
            }
            // unreadable pick → fall through to the inline generate below
          }
        } catch {
          // a broken candidates query must never take down the serving path
        }
      }
      if (!result && !standIn) result = await generateVariantBytes(engineArgs)

      if (result && !result.ok) return new Response(result.msg, { status: result.status })

      // Prewarm observation — ground truth of what the site actually serves. Synchronous O(1)
      // buffer work (the recorder flushes on its own timer); the response never waits on it.
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
      if (!result) return new Response('Not found', { status: 404 }) // unreachable: !result implies standIn
      return new Response(toBody(result.data), { headers: buildHeaders(result.mimeType, result.key, isAuto, cdn, isPublic) })
    },
  }
}

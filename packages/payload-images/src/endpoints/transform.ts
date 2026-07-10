/**
 * The on-demand image transform endpoint (Cloudflare-style settings in the URL).
 * Config-level — registered by the plugin so it mounts at `/api/img/...`. Same-origin:
 * the handler STREAMS bytes (it never redirects to the storage host). On a miss it
 * transforms with Sharp, responds immediately, and persists the variant after the
 * response via Next's `after()`. The authed purge endpoint lives in ./purge.ts.
 *
 * Routing note: a config-level endpoint is only consulted when the first path
 * segment isn't a collection/global slug — so the default `/img` base is safe as
 * long as no collection is named `img`.
 */
import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { routeId } from './routeId'
import type { UploadDocLike } from '../transform/source'
import { getServerSideURL } from '../lib/getServerSideURL'
import { createSingleFlight } from '../transform/coalesce'
import { setTransformConcurrency } from '../transform/limit'
import { setSharpConcurrency } from '../transform/sharpInstance'
import { GENERATED_IMAGES_SLUG } from '../collections/generatedImages'
import { type GenBytes, getOrCreateVariantBytes } from '../transform/getVariantBytes'
import {
  DEFAULT_CONSTRAINTS,
  type Format,
  negotiateFormat,
  type OutputFormat,
  parseTransformParams,
  type TransformConstraints,
} from '../transform/params'

export interface TransformEndpointConfig extends Partial<TransformConstraints> {
  /** Source image collection slug. Default `images`. */
  sourceSlug?: string
  /** Generated-images collection slug. Default `generated-images`. */
  variantSlug?: string
  /** Also emit `CDN-Cache-Control` / `Vercel-CDN-Cache-Control` (edge caching). Default true. */
  cdnCacheControl?: boolean
  /** Max concurrent Sharp transforms in this process (default `cpus - 1`, or `IMAGES_TRANSFORM_CONCURRENCY`). */
  maxConcurrency?: number
  /** Per-image libvips thread cap (default 1 for serverless safety; `0` = CPU cores, or `IMAGES_SHARP_CONCURRENCY`). */
  sharpConcurrency?: number
}

type SourceDoc = UploadDocLike & {
  id: string | number
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

const IMMUTABLE = 'public, max-age=31536000, immutable'
const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable'

const toBody = (buf: Buffer): BodyInit => buf as unknown as BodyInit //TODO: replace `as` cast with proper typing

const resolveConstraints = (cfg: TransformEndpointConfig): TransformConstraints => ({
  maxDimension: cfg.maxDimension ?? DEFAULT_CONSTRAINTS.maxDimension,
  qualityRange: cfg.qualityRange ?? DEFAULT_CONSTRAINTS.qualityRange,
  defaultQuality: cfg.defaultQuality ?? DEFAULT_CONSTRAINTS.defaultQuality,
  formats: cfg.formats ?? DEFAULT_CONSTRAINTS.formats,
  defaultFormat: cfg.defaultFormat ?? DEFAULT_CONSTRAINTS.defaultFormat,
  preferAvif: cfg.preferAvif ?? DEFAULT_CONSTRAINTS.preferAvif,
  dimensionStep: cfg.dimensionStep ?? DEFAULT_CONSTRAINTS.dimensionStep,
  maxInputPixels: cfg.maxInputPixels ?? DEFAULT_CONSTRAINTS.maxInputPixels,
})

const buildHeaders = (mime: string, key: string, isAuto: boolean, cdn: boolean, isPublic: boolean): Record<string, string> => {
  const h: Record<string, string> = {
    'Content-Type': mime,
    'Cache-Control': isPublic ? IMMUTABLE : PRIVATE_IMMUTABLE,
    ETag: `"${key}"`,
  }
  if (cdn && isPublic) {
    h['CDN-Cache-Control'] = IMMUTABLE
    h['Vercel-CDN-Cache-Control'] = IMMUTABLE
  }
  if (isAuto) h.Vary = 'Accept'
  return h
}

/** GET `/img/:id?w&h&ar&fit&q&fmt` — on-demand transform with focal-aware crop. */
export const createTransformEndpoint = (cfg: TransformEndpointConfig = {}): Endpoint => {
  const path = '/img'
  const sourceSlug = (cfg.sourceSlug || 'images') as CollectionSlug //TODO: replace `as` cast with proper typing
  const variantSlug = (cfg.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug //TODO: replace `as` cast with proper typing
  const cdn = cfg.cdnCacheControl !== false
  const constraints = resolveConstraints(cfg)
  setTransformConcurrency(cfg.maxConcurrency)
  setSharpConcurrency(cfg.sharpConcurrency)

  const sourceFlight = createSingleFlight<string, SourceDoc | null>()
  const genFlight = createSingleFlight<string, GenBytes>()

  return {
    path: `${path}/:id`,
    method: 'get',
    handler: async (req: PayloadRequest): Promise<Response> => {
      const { payload } = req

      const base = payload.config.serverURL || getServerSideURL()

      const id = routeId(req)
      if (!id) return new Response('Missing target collections id', { status: 400 })

      const parsed = parseTransformParams(req.searchParams ?? new URLSearchParams(), constraints)
      if (!parsed.ok) return new Response(parsed.error, { status: 400 })
      const p = parsed.params

      const readSource = async (user: PayloadRequest['user']): Promise<SourceDoc | null> => {
        try {
          return (await payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user })) as unknown as SourceDoc //TODO: replace `as` cast with proper typing
        } catch {
          return null
        }
      }
      let source = await sourceFlight(id, () => readSource(null))
      const isPublic = source != null
      if (!source && req.user) source = await readSource(req.user)
      if (!source || (!source.url && !source.filename)) return new Response('Not found', { status: 404 })
      const src = source

      const isAuto = p.fmt === 'auto'
      const format: OutputFormat = isAuto
        ? negotiateFormat(req.headers.get('accept'), constraints.formats, constraints.preferAvif)
        : (p.fmt as Exclude<Format, 'auto'>) //TODO: replace `as` cast with proper typing

      const result = await getOrCreateVariantBytes({
        payload,
        source: src,
        params: p,
        format,
        sourceSlug,
        variantSlug,
        base,
        maxInputPixels: constraints.maxInputPixels,
        genFlight,
      })

      if (!result.ok) return new Response(result.msg, { status: result.status })
      return new Response(toBody(result.data), { headers: buildHeaders(result.mimeType, result.key, isAuto, cdn, isPublic) })
    },
  }
}

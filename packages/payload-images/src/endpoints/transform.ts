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

import { GENERATED_IMAGES_SLUG } from '../collections/generatedImages'
import { getServerSideURL } from '../lib/getServerSideURL'
import { createSingleFlight } from '../transform/coalesce'
import { type GenBytes, getOrCreateVariantBytes } from '../transform/getVariantBytes'
import { setTransformConcurrency } from '../transform/limit'
import {
  DEFAULT_CONSTRAINTS,
  type Format,
  negotiateFormat,
  type OutputFormat,
  parseTransformParams,
  type TransformConstraints,
} from '../transform/params'
import { setSharpConcurrency } from '../transform/sharpInstance'
import type { UploadDocLike } from '../transform/source'
import { routeId } from './routeId'

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

const toBody = (buf: Buffer): BodyInit => buf as unknown as BodyInit

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
  const sourceSlug = (cfg.sourceSlug || 'images') as CollectionSlug
  const variantSlug = (cfg.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug
  const cdn = cfg.cdnCacheControl !== false
  const constraints = resolveConstraints(cfg)
  setTransformConcurrency(cfg.maxConcurrency)
  setSharpConcurrency(cfg.sharpConcurrency)

  // Per-endpoint single-flight maps: dedupe the source read across one <img>'s srcset
  // widths, and coalesce variant generation under a thundering herd. See ./coalesce.
  const sourceFlight = createSingleFlight<string, SourceDoc | null>()
  const genFlight = createSingleFlight<string, GenBytes>()

  return {
    path: `${path}/:id`,
    method: 'get',
    handler: async (req: PayloadRequest): Promise<Response> => {
      const { payload } = req

      //NOTE: This origin is ONLY used to self-fetch an original from *relative-URL* storage.
      //NOTE: Absolute-URL adapters (Vercel Blob, S3-public) fetch doc.url directly, and local disk
      //NOTE: reads the filesystem — both paths ignore `base` entirely. The chain self-resolves per
      //NOTE: environment (serverURL -> env -> req.origin -> localhost), so it works zero-config and
      //NOTE: a missing serverURL is NOT a general 502 risk. The fallbacks are intentional — do not
      //NOTE: "harden" this by requiring serverURL; relative-URL storage is the only case that needs it.
      const base = payload.config.serverURL || getServerSideURL()

      const id = routeId(req)
      if (!id) return new Response('Missing target collections id', { status: 400 })

      const parsed = parseTransformParams(req.searchParams ?? new URLSearchParams(), constraints)
      if (!parsed.ok) return new Response(parsed.error, { status: 400 })
      const p = parsed.params

      const readSource = async (user: PayloadRequest['user']): Promise<SourceDoc | null> => {
        try {
          return (await payload.findByID({ collection: sourceSlug, id, depth: 0, overrideAccess: false, user })) as unknown as SourceDoc
        } catch {
          return null
        }
      }
      // The anonymous read is shareable across the concurrent srcset requests for this
      // id, so coalesce it; the per-user fallback (private sources) stays uncoalesced.
      let source = await sourceFlight(id, () => readSource(null))
      const isPublic = source != null
      if (!source && req.user) source = await readSource(req.user)
      if (!source || (!source.url && !source.filename)) return new Response('Not found', { status: 404 })
      const src = source

      const isAuto = p.fmt === 'auto'
      const format: OutputFormat = isAuto
        ? negotiateFormat(req.headers.get('accept'), constraints.formats, constraints.preferAvif)
        : (p.fmt as Exclude<Format, 'auto'>)

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

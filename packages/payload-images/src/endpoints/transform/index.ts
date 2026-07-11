/**
 * The on-demand image transform endpoint (settings in the URL), mounted at `/api/img/...`.
 * Same-origin: streams bytes, never redirects to the storage host. On a miss it transforms with
 * Sharp, responds immediately, and persists the variant after the response. Config-level
 * endpoints are only consulted when the first path segment isn't a collection/global slug — so
 * `/img` is safe as long as no collection is named `img` (the plugin warns at boot).
 */
import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { routeId } from '../routeId'
import { getServerSideURL } from '../../lib/getServerSideURL'
import { setTransformConcurrency } from '../../lib/transform/limit'
import { setSharpConcurrency } from '../../lib/transform/sharpInstance'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { getOrCreateVariantBytes } from '../../lib/transform/getVariantBytes'
import { negotiateFormat, parseTransformParams } from '../../lib/transform/params'
import type { GenBytes, OutputFormat, SourceDoc, TransformEndpointConfig } from '../../types'

import { createSingleFlight } from './coalesce'
import { buildHeaders, toBody } from './response'
import { resolveConstraints } from './config'
import { readSourceDoc } from './sourceDoc'

export type { TransformEndpointConfig } from '../../types'

/** GET `/img/:id?w&h&ar&fit&q&fmt` — on-demand transform with focal-aware crop. */
export const createTransformEndpoint = (cfg: TransformEndpointConfig = {}): Endpoint => {
  const sourceSlug = (cfg.sourceSlug || 'images') as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
  const variantSlug = (cfg.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug //EXCUSE: same as sourceSlug above
  const cdn = cfg.cdnCacheControl !== false
  const constraints = resolveConstraints(cfg)
  setTransformConcurrency(cfg.maxConcurrency)
  setSharpConcurrency(cfg.sharpConcurrency)

  const sourceFlight = createSingleFlight<string, SourceDoc | null>()
  const genFlight = createSingleFlight<string, GenBytes>()

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

/**
 * The Sanity-style fetch helper. Packages can't reach the app's cached Payload instance, so the
 * app seeds the factory ONCE with its own handle — the promise from `getPayload({ config })` is
 * welcome as-is, since only the async terminal awaits it:
 *
 *   export const imageFor = createImageFor(getPayload({ config }))
 *
 *   const img = await imageFor(post.hero).aspectRatio('16:9').blur('md').fetch()
 *   if (img) return <ResponsiveImage {...img} sizes="50vw" />
 *
 * `fetch()` is the read contract in one call — `findByID` with {@link RESPONSIVE_IMAGE_SELECT}
 * and the chained render as `context: { image, blur }` — so the doc arrives render-ready
 * (`src`/`srcset`/`placeholder` finished for exactly this render) and spreads straight into
 * `<ResponsiveImage>`. Local API defaults apply (access is not scoped); reads that need their own
 * access/caching keep writing the same `findByID` themselves and wrap it however they like.
 */
import type { CollectionSlug, Payload } from 'payload'

import { readPluginMarker } from './pluginMarker'
import { RESPONSIVE_IMAGE_SELECT } from './renderIntent'
import type {
  BlurRenderIntent,
  ImageFor,
  ImageForChain,
  ImageRenderContext,
  ImageRenderIntent,
  ImageSource,
  ResponsiveImageDoc,
} from '../types'

interface ChainState {
  source: ImageSource
  image?: ImageRenderIntent
  blur?: BlurRenderIntent
}

/** The id off a source: bare id or populated doc; null when there's nothing to fetch. */
const sourceId = (source: ImageSource): string | number | null => {
  const id = typeof source === 'object' && source !== null ? source.id : source
  return id == null || id === '' ? null : id
}

/** Seed with the app's Payload handle (instance or the `getPayload({ config })` promise). */
export const createImageFor = (payload: Payload | Promise<Payload>): ImageFor => {
  const chain = (state: ChainState): ImageForChain => ({
    aspectRatio: (aspectRatio) => chain({ ...state, image: { ...state.image, aspectRatio } }),
    quality: (quality) => chain({ ...state, image: { ...state.image, quality } }),
    fit: (fit) => chain({ ...state, image: { ...state.image, fit } }),
    format: (format) => chain({ ...state, image: { ...state.image, format } }),
    blur: (quality) => chain({ ...state, blur: { ...state.blur, quality } }),
    fetch: async () => {
      const id = sourceId(state.source)
      if (id == null) return null
      const p = await payload
      const collection = (readPluginMarker(p.config).sourceSlug ?? 'images') as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
      // Typed by the contract, widened to payload's indexed RequestContext at the call.
      const context: Record<string, unknown> = {
        ...(state.image ? { image: state.image } : {}),
        ...(state.blur ? { blur: state.blur } : {}),
      } satisfies ImageRenderContext
      const doc = await p.findByID({ id, collection, depth: 0, select: RESPONSIVE_IMAGE_SELECT, context, disableErrors: true })
      return (doc as ResponsiveImageDoc | null) ?? null //EXCUSE: findByID's generated return type doesn't exist inside the plugin; the select IS this shape
    },
  })
  return (source, render) =>
    chain({ source, ...(render?.image ? { image: render.image } : {}), ...(render?.blur ? { blur: render.blur } : {}) })
}

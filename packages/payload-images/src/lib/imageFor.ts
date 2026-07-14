import type { Payload } from 'payload'

import { asSlug } from './asSlug'
import { isRecord } from './isRecord'
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

const sourceId = (source: ImageSource): string | number | null => {
  const id = typeof source === 'object' && source !== null ? source.id : source
  return id == null || id === '' ? null : id
}

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
      const collection = asSlug(readPluginMarker(p.config).sourceSlug ?? 'images')
      const context: Record<string, unknown> = {
        ...(state.image ? { image: state.image } : {}),
        ...(state.blur ? { blur: state.blur } : {}),
      } satisfies ImageRenderContext
      const doc = await p.findByID({ id, collection, depth: 0, select: RESPONSIVE_IMAGE_SELECT, context, disableErrors: true })
      // The RESPONSIVE_IMAGE_SELECT projection produces this row's shape; a light record check confirms a real doc.
      const isResponsive = (v: unknown): v is ResponsiveImageDoc => isRecord(v)
      return isResponsive(doc) ? doc : null
    },
  })
  return (source, render) =>
    chain({ source, ...(render?.image ? { image: render.image } : {}), ...(render?.blur ? { blur: render.blur } : {}) })
}

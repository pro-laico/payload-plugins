import type { Payload } from 'payload'

import { asSlug } from './asSlug'
import { isRecord } from './isRecord'
import { readImagesMarker } from './marker'
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

let warnedMissingCollection = false

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
      const collection = asSlug(readImagesMarker(p.config)?.sourceSlug ?? 'images')
      // Keep the documented img-or-null contract when the plugin isn't registered (enabled: false,
      // preview/CI env) — findByID would otherwise reject with a generic unknown-collection APIError.
      if (p.collections && !(collection in p.collections)) {
        if (!warnedMissingCollection) {
          warnedMissingCollection = true
          p.logger.warn(`[payload-images] imageFor: collection "${collection}" is not registered — is the plugin enabled? Returning null.`)
        }
        return null
      }
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

import type { FieldHook } from 'payload'

import { buildSrcset } from '../../lib/urls/srcset'
import { deriveVersion } from '../../lib/urls/version'
import { getImageUrl } from '../../lib/urls/getImageUrl'
import { readImageIntent } from '../../lib/renderIntent'
import { readPluginMarker } from '../../lib/pluginMarker'
import { buildVariantUrl } from '../../lib/urls/variantUrl'
import type { ImageDocLike, ParsedRenderIntent } from '../../types'

export const naturalAspectRatio = (d: ImageDocLike): number | undefined => (d.width && d.height ? d.width / d.height : undefined)

interface ComputeContext {
  baseUrl: string
  pixelStep?: number | number[]
  intent: ParsedRenderIntent
}

type SavedImageDoc = ImageDocLike & { id: string | number }

const urlHook =
  (compute: (doc: SavedImageDoc, ctx: ComputeContext) => string | null): FieldHook =>
  ({ data, req }) => {
    const doc = (data ?? {}) as ImageDocLike //TODO: replace `as` cast with proper typing
    if (doc.id == null || !doc.filename) return null
    const cfg = req?.payload?.config
    const ctx = { baseUrl: cfg?.serverURL || '', pixelStep: readPluginMarker(cfg).pixelStep, intent: readImageIntent(req) }
    return compute(doc as SavedImageDoc, ctx) //TODO: replace `as` cast with proper typing
  }

export const aspectRatioAfterRead: FieldHook = ({ data, req }) => {
  const doc = (data ?? {}) as ImageDocLike //TODO: replace `as` cast with proper typing
  return readImageIntent(req).aspectRatio ?? naturalAspectRatio(doc) ?? null
}

export const variantVersionAfterRead: FieldHook = urlHook((d) => deriveVersion(d) ?? null)

export const srcAfterRead: FieldHook = urlHook((d, { baseUrl, intent }) =>
  getImageUrl(d, {
    width: Math.min(d.width ?? 1280, 1280),
    aspectRatio: intent.aspectRatio,
    quality: intent.quality,
    fit: intent.fit,
    format: intent.format,
    baseUrl,
  }),
)

export const srcsetAfterRead: FieldHook = urlHook(
  (d, { baseUrl, pixelStep, intent }) =>
    buildSrcset(d, {
      aspectRatio: intent.aspectRatio ?? naturalAspectRatio(d),
      quality: intent.quality,
      fit: intent.fit,
      format: intent.format,
      baseUrl,
      pixelStep,
    })?.srcset ?? null,
)

export const placeholderUrlAfterRead: FieldHook = urlHook((d, { baseUrl, intent }) =>
  buildVariantUrl(String(d.id), 32, {
    quality: 40,
    aspectRatio: intent.aspectRatio ?? naturalAspectRatio(d),
    version: deriveVersion(d),
    baseUrl,
  }),
)

export const thumbnailUrlAfterRead: FieldHook = urlHook((d, { baseUrl }) =>
  buildVariantUrl(String(d.id), 160, { fit: 'cover', aspectRatio: 1, version: deriveVersion(d), baseUrl }),
)

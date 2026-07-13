/**
 * The afterRead hooks behind the six virtual render fields declared inline on the images
 * collection (collections/images.ts): `aspectRatio`, `variantVersion`, `src`, `srcset`,
 * `placeholderURL`, `thumbnailURL`. Each URL hook bails to null on an unsaved/fileless doc,
 * then builds its value from the doc + compute context (origin, srcset step, declared render).
 */
import type { FieldHook } from 'payload'

import { deriveVersion } from '../../lib/urls/version'
import { buildSrcset } from '../../lib/urls/srcset'
import { getImageUrl } from '../../lib/urls/getImageUrl'
import { buildVariantUrl } from '../../lib/urls/variantUrl'
import { readPluginMarker } from '../../lib/pluginMarker'
import { readImageIntent } from '../../lib/renderIntent'
import type { ImageDocLike, ParsedRenderIntent } from '../../types'

export const naturalAspectRatio = (d: ImageDocLike): number | undefined => (d.width && d.height ? d.width / d.height : undefined)

/** What every URL computer gets: the origin, the project's srcset step, and the declared render. */
interface ComputeContext {
  baseUrl: string
  pixelStep?: number | number[]
  intent: ParsedRenderIntent
}

type SavedImageDoc = ImageDocLike & { id: string | number }

/** Shared guard + context: null for an unsaved/fileless doc, else run `compute` on the saved doc. */
const urlHook =
  (compute: (doc: SavedImageDoc, ctx: ComputeContext) => string | null): FieldHook =>
  ({ data, req }) => {
    const doc = (data ?? {}) as ImageDocLike //EXCUSE: hook data is untyped; every field is duck-checked before use
    if (doc.id == null || !doc.filename) return null
    const cfg = req?.payload?.config
    const ctx = { baseUrl: cfg?.serverURL || '', pixelStep: readPluginMarker(cfg).pixelStep, intent: readImageIntent(req) }
    return compute(doc as SavedImageDoc, ctx) //EXCUSE: the id-null guard above doesn't narrow the object binding
  }

/** `aspectRatio`: the ratio the read declared (context.image), else the natural one. */
export const aspectRatioAfterRead: FieldHook = ({ data, req }) => {
  const doc = (data ?? {}) as ImageDocLike //EXCUSE: hook data is untyped; every field is duck-checked before use
  return readImageIntent(req).aspectRatio ?? naturalAspectRatio(doc) ?? null
}

/** `variantVersion`: cache-busting token (changes on file replace / focal / hotspot edits). */
export const variantVersionAfterRead: FieldHook = urlHook((d) => deriveVersion(d) ?? null)

/** `src`: optimized URL (≤1280px) for a plain <img> or OG tag, honoring the declared render. */
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

/** `srcset`: responsive srcset up to the source width, honoring the declared render (else the natural ratio). */
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

/** `placeholderURL`: tiny low-quality placeholder (LQIP) for a blur-up / CSS background. */
export const placeholderUrlAfterRead: FieldHook = urlHook((d, { baseUrl, intent }) =>
  buildVariantUrl(String(d.id), 32, {
    quality: 40,
    aspectRatio: intent.aspectRatio ?? naturalAspectRatio(d),
    version: deriveVersion(d),
    baseUrl,
  }),
)

/** `thumbnailURL`: small focal-cropped square (160px) for cards, lists, and feeds. */
export const thumbnailUrlAfterRead: FieldHook = urlHook((d, { baseUrl }) =>
  buildVariantUrl(String(d.id), 160, { fit: 'cover', aspectRatio: 1, version: deriveVersion(d), baseUrl }),
)

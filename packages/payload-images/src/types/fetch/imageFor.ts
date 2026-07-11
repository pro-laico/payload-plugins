/**
 * Types for the Sanity-style fetch helper: seed `createImageFor` once with the project's Payload
 * handle, chain the declared render, `fetch()` the render-ready doc.
 */
import type { Fit, Format } from '../transform/format'
import type { PlaceholderQuality } from '../../lib/placeholders/qualities'
import type { AspectRatio, ImageRenderContext, ResponsiveImageDoc } from '../plugin/renderIntent'

/** What `imageFor` accepts: an image doc id, a populated doc (its id is used), or nothing — `fetch()` then resolves `null`. */
export type ImageSource = string | number | { id: string | number } | null | undefined

/** The seeded helper an app exports once: `imageFor(source)` starts a chain. A whole declared
 *  render can seed it in one go (`imageFor(id, { image, blur })`); the setters chain on top. */
export type ImageFor = (source: ImageSource, render?: ImageRenderContext) => ImageForChain

/** An immutable render-declaration chain — every setter returns a new chain, so a partially
 *  applied one (`imageFor(id).aspectRatio('1:1')`) can be shared and branched safely. */
export interface ImageForChain {
  /** The render's ratio — shapes `src`/`srcset` geometry and the placeholder crop. → `context.image.aspectRatio` */
  aspectRatio(ratio: AspectRatio): ImageForChain
  /** Transform quality (1–100, default 75). → `context.image.quality` */
  quality(quality: number): ImageForChain
  /** Transform fit (default `cover`). → `context.image.fit` */
  fit(fit: Fit): ImageForChain
  /** Output format (default `auto`). → `context.image.format` */
  format(format: Format): ImageForChain
  /** Placeholder tier: `xs`…`xl` (blurhash) or `xxl`/`x3` (micro-webp), default `sm`. → `context.blur.quality` */
  blur(quality: PlaceholderQuality): ImageForChain
  /** One `findByID` declaring the chained render — resolves the render-ready doc,
   *  or `null` for an empty source / missing doc. */
  fetch(): Promise<ResponsiveImageDoc | null>
}

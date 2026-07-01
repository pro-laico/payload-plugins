/**
 * `<ResponsiveImage>` — a single plain `<img>` carrying a `srcset` of on-demand transform URLs,
 * with a faithful **inline LQIP** painted as its own `background-image`: a tiny base64 data-URI
 * (generated server-side at the requested aspect-ratio + focal point, zero network) shows
 * instantly, and the real image paints over it on load — the swap is native, no JS, no `<head>`
 * script. An async server component: it resolves the project config (pixel step + placeholder
 * settings), generates the LQIP via the shared variant cache, and renders one `<img>`. Not
 * `next/image`.
 *
 * `className` / `style` / `dataAttributes` all go on the `<img>` itself (size / space / round it
 * there). The LQIP is on by default; pass `blur={false}` (or the plugin's `placeholder: false`)
 * to skip it, and it's skipped automatically when there's no populated doc to generate from.
 */
import type { SanitizedConfig } from 'payload'
import type { CSSProperties, ImgHTMLAttributes, ReactElement } from 'react'

import type { VariantSourceDoc } from '../transform/getVariantBytes'
import { type Fit, type Format, parseAspectRatio } from '../transform/params'
import {
  type BuildSrcsetOptions,
  buildSrcset,
  type BuildUrlOptions,
  buildVariantUrl,
  deriveVersion,
  type GetImageUrlOptions,
  getImageUrl,
  type ImageResource,
  stepWidths,
} from '../utils/urls'

// Re-export the isomorphic URL builders so this single subpath covers the whole frontend API —
// `import { ResponsiveImage, getImageUrl } from '@pro-laico/payload-images/components/image'`.
// (The `utils/urls` subpath stays available for importing the builders without the component.)
export { buildSrcset, buildVariantUrl, deriveVersion, getImageUrl, stepWidths }
export type { BuildSrcsetOptions, BuildUrlOptions, Fit, Format, GetImageUrlOptions, ImageResource }

/** A bare id, or a populated image doc (for natural dims, alt, the version token, and inline-LQIP generation). */
export type ResponsiveImageInput =
  | string
  | number
  | {
      id: string | number
      width?: number | null
      height?: number | null
      alt?: string | null
      filename?: string | null
      url?: string | null
      focalX?: number | null
      focalY?: number | null
    }

type Awaitable<T> = T | Promise<T>

/** Placeholder override: `false` off · `true`/unset on (defaults) · a number = LQIP width (px) · `{ width?, quality? }` = tuned. */
export type PlaceholderProp = boolean | number | { width?: number; quality?: number }

/** Resolve the `placeholder` prop (falling back to the deprecated `blur`) to on/off + optional width/quality. */
const resolvePlaceholderProp = (placeholder: PlaceholderProp | undefined, blur: boolean): { on: boolean; width?: number; quality?: number } => {
  if (placeholder === false) return { on: false }
  if (placeholder === true) return { on: true }
  if (typeof placeholder === 'number') return { on: true, width: placeholder }
  if (placeholder && typeof placeholder === 'object') return { on: true, width: placeholder.width, quality: placeholder.quality }
  return { on: blur } // `placeholder` unset → legacy `blur` (default true)
}

export interface ResponsiveImageProps {
  image: ResponsiveImageInput
  alt?: string
  /** The `sizes` attribute. Default `100vw`. */
  sizes?: string
  /** Render aspect ratio (`16/9` | `"16:9"`); falls back to the doc's natural ratio. Ignored when `fill` is set. */
  aspectRatio?: number | string
  /**
   * Cover-fill a height-driven parent instead of acting as an aspect-ratio box. The `<img>`
   * becomes `position:absolute; inset:0; size:100%` with `object-fit:<fit>` and NO aspect-ratio
   * — so it fills a parent that sets its own height (full-bleed hero, carousel slide, map panel).
   * The parent must be positioned. The placeholder still applies. Default false.
   */
  fill?: boolean
  quality?: number
  fit?: Fit
  format?: Format
  /** Override the source intrinsic width used to cap the srcset (else read from a populated doc). */
  sourceWidth?: number
  /** Native `<img>` `loading`. Default `lazy`; set `eager` for an above-the-fold hero. */
  loading?: 'lazy' | 'eager'
  /** Native `<img>` `fetchpriority`. Default `auto`; set `high` for the LCP image. */
  fetchPriority?: 'high' | 'low' | 'auto'
  /** Native `<img>` `decoding` hint. Default `async`. */
  decoding?: 'async' | 'auto' | 'sync'
  /** Applied to the `<img>` (size / space / round it here). */
  className?: string
  /** Merged onto the `<img>`'s style. */
  style?: CSSProperties
  /** Absolute base for the generated URLs (default same-origin). */
  baseUrl?: string
  /** Transform endpoint base. Default `/api/img`; set it only if your Payload API route or Next.js basePath differs. */
  path?: string
  /** Payload config, used to resolve the project `pixelStep`. Defaults to the `@payload-config` alias
   *  that `withPayload` sets up; pass it explicitly for a non-aliased setup. */
  config?: Awaitable<SanitizedConfig>
  /** Explicit cache-busting version token (`v=`); overrides the one derived from the doc's filename + focal. */
  version?: string
  /**
   * Inline LQIP placeholder. `false` disables it; a **number** sets the LQIP width in px; an object
   * tunes `{ width, quality }`. Keep the width small — the LQIP is base64-inlined in **every**
   * response (~0.6 KB at 24px, ~2 KB at 48, ~3–4 KB at 64), so **24–64 is the sweet spot**; larger
   * just bloats the HTML. Defaults to the project `placeholder` config (24px). Supersedes `blur`.
   */
  placeholder?: PlaceholderProp
  /** @deprecated Use `placeholder` instead (`placeholder={false}` to disable). */
  blur?: boolean
  /** Extra attributes (e.g. `data-*`) spread onto the `<img>`. */
  dataAttributes?: Record<string, string>
}

const CSS_OBJECT_FIT: Record<Fit, NonNullable<CSSProperties['objectFit']>> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
  inside: 'contain',
  outside: 'cover',
}

const idOf = (image: ResponsiveImageInput): string => (typeof image === 'object' ? String(image.id ?? '') : String(image ?? ''))

export const ResponsiveImage = async (props: ResponsiveImageProps): Promise<ReactElement | null> => {
  const {
    image,
    alt,
    sizes = '100vw',
    aspectRatio,
    fill = false,
    quality = 75,
    fit = 'cover',
    format = 'auto',
    sourceWidth,
    loading = 'lazy',
    fetchPriority = 'auto',
    decoding = 'async',
    className,
    style,
    baseUrl,
    path,
    version,
    placeholder,
    blur = true,
    dataAttributes,
    config,
  } = props

  const id = idOf(image)
  if (!id) return null

  // Resolve the Payload config once (the srcset's `pixelStep` and the placeholder settings both
  // come off it). `@payload-config` is the host bundler's alias (set up by `withPayload`);
  // `as string` keeps TS from resolving it at this package's build. Stays undefined if unreadable.
  let cfg: SanitizedConfig | undefined
  try {
    cfg = await (config ?? ((await import('@payload-config' as string)).default as Awaitable<SanitizedConfig>))
  } catch {
    cfg = undefined
  }
  const pixelStep = (cfg as { custom?: { payloadImages?: { pixelStep?: number | number[] } } } | undefined)?.custom?.payloadImages?.pixelStep

  const doc = typeof image === 'object' ? image : undefined
  const altText = alt ?? doc?.alt ?? ''
  const naturalW = doc?.width ?? undefined
  const naturalH = doc?.height ?? undefined
  // Warn (dev only) when an aspectRatio was passed but doesn't parse — we silently fall back to the
  // natural ratio, which is easy to miss; mirrors how Sanity's reference component surfaces this.
  if (!fill && aspectRatio != null && parseAspectRatio(aspectRatio) === undefined && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[payload-images] Invalid aspectRatio ${JSON.stringify(aspectRatio)} — expected "w/h", "w:h", or a positive number. Falling back to the image's natural ratio.`,
    )
  }
  const ar = fill ? undefined : (parseAspectRatio(aspectRatio) ?? (naturalW && naturalH ? naturalW / naturalH : undefined))

  const opts: BuildSrcsetOptions = {
    fit,
    quality,
    format,
    aspectRatio: ar,
    baseUrl,
    path,
    pixelStep,
    sourceWidth: sourceWidth ?? naturalW,
    version: version ?? deriveVersion(doc),
  }
  const { srcset, src } = buildSrcset(id, opts)

  // The faithful inline LQIP: a tiny base64 variant at this exact ratio/focal, generated
  // server-side (shared variant cache) and painted as the <img>'s own background — instant,
  // zero network, covered when the real image loads. Needs a populated doc + the config;
  // the engine is dynamic-imported so the non-placeholder path never bundles Sharp/getPayload.
  const ph = resolvePlaceholderProp(placeholder, blur)
  let lqip: string | undefined
  if (ph.on && cfg && doc?.filename) {
    try {
      const { generateInlineLqip } = await import('./inlineLqip')
      // Trusted (component) call: the requested width is honored (no `untrusted` clamp).
      lqip = await generateInlineLqip({ config: cfg, source: doc as VariantSourceDoc, ar, fit, width: ph.width, quality: ph.quality })
    } catch {
      lqip = undefined
    }
  }

  const intrinsicW = naturalW ?? (ar ? 1280 : undefined)
  const intrinsicH = naturalH ?? (ar && intrinsicW ? Math.round(intrinsicW / ar) : undefined)
  const bgSize = fit === 'contain' || fit === 'inside' ? 'contain' : 'cover'

  return (
    // biome-ignore lint/performance/noImgElement: intentional plain <img> — a hand-built srcset + inline LQIP that next/image would defeat
    <img
      src={src}
      srcSet={srcset}
      sizes={sizes}
      alt={altText}
      width={intrinsicW}
      height={intrinsicH}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: fill ? '100%' : 'auto',
        ...(ar ? { aspectRatio: String(ar) } : null),
        objectFit: CSS_OBJECT_FIT[fit],
        ...(fill ? { position: 'absolute', inset: 0 } : null),
        ...(lqip
          ? { backgroundImage: `url(${lqip})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : null),
        ...style,
      }}
      {...(dataAttributes as ImgHTMLAttributes<HTMLImageElement>)}
    />
  )
}

export default ResponsiveImage

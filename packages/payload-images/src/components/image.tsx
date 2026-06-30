/**
 * `<ResponsiveImage>` — a wrapper carrying an LQIP placeholder (the smallest transform
 * variant, set as the wrapper's background and upscaled by the browser to a soft blur),
 * with a plain `<img>` (a `srcset` of on-demand transform URLs, settings baked into each
 * entry) painted over it: the placeholder shows until the real image downloads and covers
 * it. It needs only the image id; the endpoint reads the focal point and crops server-side.
 * An async server component: it resolves the project `pixelStep` from your Payload config, then
 * renders a plain `<img>` — no hydration, no stored placeholder field. Not `next/image`.
 *
 * `className` / `style` go on the wrapper (the image "box" — size/space/round it
 * with utilities there); `dataAttributes` go on the `<img>`.
 */
import type { SanitizedConfig } from 'payload'
import type { CSSProperties, ImgHTMLAttributes, ReactElement } from 'react'

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
} from './buildSrcset'

// Re-export the isomorphic URL builders so this single client-safe subpath covers the whole
// frontend API — `import { ResponsiveImage, getImageUrl } from '@pro-laico/payload-images/components/image'`.
// (The `./buildSrcset` subpath stays available for importing the builders without the component.)
export { buildSrcset, buildVariantUrl, deriveVersion, getImageUrl, stepWidths }
export type { BuildSrcsetOptions, BuildUrlOptions, Fit, Format, GetImageUrlOptions, ImageResource }

/** A bare id, or a populated image doc (for natural dims, alt, and the cache-busting version token). */
export type ResponsiveImageInput =
  | string
  | number
  | {
      id: string | number
      width?: number | null
      height?: number | null
      alt?: string | null
      filename?: string | null
      focalX?: number | null
      focalY?: number | null
    }

type Awaitable<T> = T | Promise<T>

/** Width / quality of the LQIP placeholder variant — tiny on purpose; the browser upscales it to a soft blur. */
const PLACEHOLDER_WIDTH = 32
const PLACEHOLDER_QUALITY = 40

export interface ResponsiveImageProps {
  image: ResponsiveImageInput
  alt?: string
  /** The `sizes` attribute. Default `100vw`. */
  sizes?: string
  /** Render aspect ratio (`16/9` | `"16:9"`); falls back to the doc's natural ratio. Ignored when `fill` is set. */
  aspectRatio?: number | string
  /**
   * Cover-fill a height-driven parent instead of acting as an aspect-ratio box. The wrapper
   * becomes `position:absolute; inset:0; size:100%` and the `<img>` renders `width/height:100%`
   * with `object-fit:<fit>` and NO aspect-ratio — so it fills a parent that sets its own height
   * (full-bleed hero, carousel slide, map panel). The parent must be positioned. The placeholder
   * still applies. Default false.
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
  /** Applied to the wrapper (the image box). */
  className?: string
  /** Merged onto the wrapper (the image box). */
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
  /** Show the LQIP placeholder (a tiny transform variant, painted as the wrapper background). Default true. */
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
    blur = true,
    dataAttributes,
    config,
  } = props

  const id = idOf(image)
  if (!id) return null

  // The srcset is a static string (CMS values + the project pixel step), so build it on the server:
  // resolve `pixelStep` from the plugin config. `@payload-config` is the host bundler's alias (set up
  // by `withPayload`); `as string` keeps TS from resolving it at this package's build. Falls back to
  // buildSrcset's default if the config can't be read.
  let pixelStep: number | number[] | undefined
  try {
    const cfg = await (config ?? ((await import('@payload-config' as string)).default as Awaitable<SanitizedConfig>))
    pixelStep = (cfg as { custom?: { payloadImages?: { pixelStep?: number | number[] } } }).custom?.payloadImages?.pixelStep
  } catch {
    pixelStep = undefined
  }

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
  // The LQIP placeholder is the smallest transform variant (a tiny, low-quality crop sharing the
  // same fit/format/focal/version); the browser upscales it to a soft blur behind the real image.
  const blurSrc = blur ? buildVariantUrl(id, PLACEHOLDER_WIDTH, { ...opts, quality: PLACEHOLDER_QUALITY }) : undefined

  const intrinsicW = naturalW ?? (ar ? 1280 : undefined)
  const intrinsicH = naturalH ?? (ar && intrinsicW ? Math.round(intrinsicW / ar) : undefined)

  return (
    <span
      className={className}
      style={{
        display: 'block',
        overflow: 'hidden',
        width: '100%',
        ...(fill ? { position: 'absolute', inset: 0, height: '100%' } : null),
        ...(blurSrc
          ? { backgroundImage: `url(${blurSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : null),
        ...style,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: intentional plain <img> — a hand-built srcset + LQIP that next/image would defeat */}
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
        style={{
          display: 'block',
          width: '100%',
          height: fill ? '100%' : 'auto',
          ...(ar ? { aspectRatio: String(ar) } : null),
          objectFit: CSS_OBJECT_FIT[fit],
        }}
        {...(dataAttributes as ImgHTMLAttributes<HTMLImageElement>)}
      />
    </span>
  )
}

export default ResponsiveImage

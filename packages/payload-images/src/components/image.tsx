/**
 * `<ResponsiveImage>` — a single plain `<img>` carrying a `srcset` of on-demand transform URLs,
 * with the doc's placeholder painted as its own `background-image`: shows instantly, and the
 * real image paints over it on load — the swap is native, no JS, no `<head>` script. A passive
 * async server component: it renders what it's handed, fetches nothing, and never touches
 * Payload. Not `next/image`.
 *
 * The placeholder work happens in the READ, not here: fetch the doc with
 * `req.context.blurhash = { ar, quality }` and `croppedBlurHash` arrives as a finished,
 * focal-cropped data URI this component just paints. (A raw hash string — a read that didn't
 * declare intent — is still rendered to an inline PNG here as a fallback.)
 *
 * `className` / `style` / `dataAttributes` all go on the `<img>` itself (size / space / round it
 * there). The placeholder renders whenever the doc carries `croppedBlurHash`; pass
 * `placeholder={false}` to skip it.
 */
import type { SanitizedConfig } from 'payload'
import type { CSSProperties, ImgHTMLAttributes, ReactElement } from 'react'

import { stashedConfig } from '../lib/configStash'
import { blurhashToPngDataUri } from '../blurhash/png'
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

export { buildSrcset, buildVariantUrl, deriveVersion, getImageUrl, stepWidths }
export type { BuildSrcsetOptions, BuildUrlOptions, Fit, Format, GetImageUrlOptions, ImageResource }

/**
 * A bare id, or a populated image doc. The component is passive: it renders what it's handed.
 * Fetch the doc with `req.context.blurhash = { ar, quality }` so `croppedBlurHash` arrives as
 * a finished data URI cropped to the ratio you're rendering, and select `variantVersion` so
 * URLs carry the cache-busting token — nothing else placeholder-related needs selecting.
 */
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
      croppedBlurHash?: string | null
      variantVersion?: string | null
    }

type Awaitable<T> = T | Promise<T>

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
  /** Payload config, used to resolve the project `pixelStep`. Rarely needed: without it the
   *  component uses the config the plugin stashed at init, falling back to the `@payload-config`
   *  alias `withPayload` sets up. Pass it explicitly only for a non-standard setup. */
  config?: Awaitable<SanitizedConfig>
  /** Explicit cache-busting version token (`v=`); overrides the doc's `variantVersion` (and the
   *  filename-derived fallback). */
  version?: string
  /**
   * Paint the doc's `croppedBlurHash` behind the image while it loads (a tiny inline image,
   * zero network, zero client JS). `false` skips it even when the doc carries one. The
   * quality/crop are decided by the READ that fetched the doc (`req.context.blurhash`), not here.
   */
  placeholder?: boolean
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

let warnedNoConfig = false
let warnedBadBlurhash = false

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
    dataAttributes,
    config,
  } = props

  const id = idOf(image)
  if (!id) return null

  let cfg: SanitizedConfig | undefined
  try {
    cfg = await (config ?? stashedConfig() ?? ((await import('@payload-config' as string)).default as Awaitable<SanitizedConfig>)) //TODO: replace `as` casts with proper typing
  } catch {
    cfg = undefined
  }
  if (!cfg && process.env.NODE_ENV !== 'production' && !warnedNoConfig) {
    warnedNoConfig = true
    console.warn(
      "[payload-images] <ResponsiveImage> could not resolve the Payload config — the project pixelStep setting is skipped (default step applies). Pass the `config` prop, or add `transpilePackages: ['@pro-laico/payload-images']` to next.config so the `@payload-config` alias resolves.",
    )
  }
  const pixelStep = (cfg as { custom?: { payloadImages?: { pixelStep?: number | number[] } } } | undefined)?.custom?.payloadImages?.pixelStep //TODO: replace `as` cast with proper typing

  const doc = typeof image === 'object' ? image : undefined
  const altText = alt ?? doc?.alt ?? ''
  const naturalW = doc?.width ?? undefined
  const naturalH = doc?.height ?? undefined
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
    version: version ?? doc?.variantVersion ?? deriveVersion(doc),
  }
  const { srcset, src } = buildSrcset(id, opts)

  let lqip: string | undefined
  const placeholderValue = placeholder !== false ? doc?.croppedBlurHash : undefined
  if (placeholderValue?.startsWith('data:')) lqip = placeholderValue
  else if (placeholderValue) {
    try {
      lqip = blurhashToPngDataUri(placeholderValue, ar ? { aspectRatio: ar } : {})
    } catch (err) {
      lqip = undefined
      if (process.env.NODE_ENV !== 'production' && !warnedBadBlurhash) {
        warnedBadBlurhash = true
        console.warn(`[payload-images] <ResponsiveImage> got an unparseable croppedBlurHash — rendering without a placeholder. ${String(err)}`)
      }
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
      //TODO: replace `as` cast with proper typing
      {...(dataAttributes as ImgHTMLAttributes<HTMLImageElement>)}
    />
  )
}

export default ResponsiveImage

/**
 * `<ResponsiveImage>` — a single plain `<img>` painting exactly what the read delivered: the
 * doc's `src`/`srcset` virtuals (built server-side for the render the getter declared via
 * `context.image`) and its `croppedBlurHash` as the `placeholder` background. Passive and sync:
 * fetches nothing, never touches Payload, server- and client-tree safe. Not `next/image`.
 *
 * The app owns one thin wrapper ({@link ImageProps}) that does the fetch: `payload.findByID`
 * with `select: RESPONSIVE_IMAGE_SELECT` and `context: { image, blur }`, then spreads the doc's
 * fields here.
 */
import type { CSSProperties, ReactElement } from 'react'
import type { Fit } from '../transform/params'
import {
  type AspectRatio,
  type BlurRenderIntent,
  type ImageGetter,
  type ImageRenderContext,
  type ImageRenderIntent,
  RESPONSIVE_IMAGE_SELECT,
  type ResponsiveImageDoc,
} from '../lib/renderIntent'

export { RESPONSIVE_IMAGE_SELECT }
export type { AspectRatio, BlurRenderIntent, Fit, ImageGetter, ImageRenderContext, ImageRenderIntent, ResponsiveImageDoc }

export interface ResponsiveImageProps {
  id: string | number
  alt: string
  /** The `sizes` attribute. Default `100vw`. */
  sizes?: string
  /** CSS aspect-ratio for the box (`16/9` | `"16/9"` | `"16:9"`) — match what the read declared.
   *  Ignored when `fill` is set. */
  aspectRatio?: AspectRatio
  /**
   * Cover-fill a height-driven parent instead of acting as an aspect-ratio box. The `<img>`
   * becomes `position:absolute; inset:0; size:100%` with `object-fit:<fit>` and NO aspect-ratio
   * — so it fills a parent that sets its own height (full-bleed hero, carousel slide, map panel).
   * The parent must be positioned. The placeholder still applies. Default false.
   */
  fill?: boolean
  /** CSS `object-fit` (and the fit for fallback-built URLs). Default `cover`. A read declaring
   *  `context.image.fit` should pass the same value here so the CSS matches the crop. */
  fit?: Fit
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
  /** The doc's `croppedBlurHash` — a finished placeholder data URI painted as the `<img>`'s
   *  background while it loads. Omit to skip the placeholder. */
  placeholder?: string | null
  /** Extra `data-*` attributes spread onto the `<img>`. */
  dataAttributes?: Record<`data-${string}`, string>
  src?: string | null | undefined
  srcset?: string | null | undefined
}

/**
 * Props for the ONE image component an app writes around its getter — pass an id + the declared
 * render, get back `<ResponsiveImage>` painting a doc fetched for exactly that render:
 *
 *   export async function Image({ id, image, blur, ...rest }: ImageProps) {
 *     const payload = await getPayload({ config })
 *     const doc = await payload.findByID({ id, collection: 'images', depth: 0, select: RESPONSIVE_IMAGE_SELECT, context: { image, blur } })
 *     return <ResponsiveImage id={doc.id} alt={doc.alt} src={doc.src} srcset={doc.srcset} placeholder={doc.croppedBlurHash} {...rest} />
 *   }
 *
 * `image`/`blur` go into the read's `context` verbatim; everything else is presentation, passed
 * through. Wrap the fetch in your cache layer (keyed by id + render) when you have one.
 */
export interface ImageProps extends Omit<ResponsiveImageProps, 'id' | 'alt' | 'src' | 'srcset' | 'placeholder'> {
  /** The image doc id — the component fetches the rest itself. */
  id: string | number
  /** The declared render — becomes `context.image` (srcset geometry/quality/fit/format). */
  image?: ImageRenderIntent
  /** The declared placeholder — becomes `context.blur` (tier + answer form). */
  blur?: BlurRenderIntent
}

const CSS_OBJECT_FIT: Record<Fit, NonNullable<CSSProperties['objectFit']>> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
  inside: 'contain',
  outside: 'cover',
}

export const ResponsiveImage = (props: ResponsiveImageProps): ReactElement | null => {
  const {
    alt,
    sizes = '100vw',
    aspectRatio,
    fill = false,
    fit = 'cover',
    loading = 'lazy',
    fetchPriority = 'auto',
    decoding = 'async',
    className,
    style,
    placeholder,
    dataAttributes,
    src,
    srcset,
  } = props

  if (!src || !srcset) return null

  // CSS accepts `16 / 9` but not the `16:9` form — normalize so both prop shapes render.
  const cssAr = typeof aspectRatio === 'string' ? aspectRatio.replace(':', ' / ') : aspectRatio
  const bgSize = fit === 'contain' || fit === 'inside' ? 'contain' : 'cover'

  return (
    // biome-ignore lint/performance/noImgElement: intentional plain <img> — a hand-built srcset + inline LQIP that next/image would defeat
    <img
      src={src}
      srcSet={srcset}
      sizes={sizes}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: fill ? '100%' : 'auto',
        ...(cssAr ? { aspectRatio: cssAr } : null),
        objectFit: CSS_OBJECT_FIT[fit],
        ...(fill ? { position: 'absolute', inset: 0 } : null),
        ...(placeholder
          ? { backgroundImage: `url(${placeholder})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : null),
        ...style,
      }}
      {...dataAttributes}
    />
  )
}

export default ResponsiveImage

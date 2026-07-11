/**
 * `<ResponsiveImage>` — a single plain `<img>` painting exactly what the read delivered: the
 * doc's `src`/`srcset` virtuals and its `croppedBlurHash` as the placeholder background.
 * Passive and sync: fetches nothing, never touches Payload, server- and client-tree safe.
 */
import type { CSSProperties, ReactElement } from 'react'
import type { Fit, ImageProps, ResponsiveImageProps } from '../types'

export type { ImageProps, ResponsiveImageProps } from '../types'

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

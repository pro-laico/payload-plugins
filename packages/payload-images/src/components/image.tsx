import type { CSSProperties, ReactElement } from 'react'

import type { Fit, ResponsiveImageProps } from '../types'
import { parseAspectRatio } from '../lib/transform/params'

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

  // `fill` means the positioned parent owns the box, so a ratio would be inert at best — and the
  // doc now carries one for every read, so this is what keeps that promise ("ignored with fill").
  const cssAr = fill ? undefined : parseAspectRatio(aspectRatio)
  const bgSize = fit === 'contain' || fit === 'inside' ? 'contain' : 'cover'
  const bg = placeholder && /^(data:|https?:|\/)/.test(placeholder) ? placeholder : undefined

  return (
    // biome-ignore lint/performance/noImgElement: intentional plain <img> — a hand-built srcset + inline LQIP that next/image would defeat
    <img
      src={src}
      sizes={sizes}
      srcSet={srcset}
      loading={loading}
      decoding={decoding}
      className={className}
      alt={alt || undefined}
      fetchPriority={fetchPriority}
      style={{
        display: 'block',
        width: '100%',
        height: fill ? '100%' : 'auto',
        ...(cssAr ? { aspectRatio: cssAr } : null),
        objectFit: CSS_OBJECT_FIT[fit],
        ...(fill ? { position: 'absolute', inset: 0 } : null),
        ...(bg ? { backgroundImage: `url(${bg})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : null),
        ...style,
      }}
      {...dataAttributes}
    />
  )
}

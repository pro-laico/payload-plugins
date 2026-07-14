import type { CSSProperties } from 'react'

import type { Fit } from '../transform/format'
import type { AspectRatio, BlurRenderIntent, ImageRenderIntent } from '../plugin/renderIntent'

export interface ResponsiveImageProps {
  id: string | number
  alt?: string | null
  sizes?: string
  aspectRatio?: AspectRatio
  fill?: boolean
  fit?: Fit
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  decoding?: 'async' | 'auto' | 'sync'
  className?: string
  style?: CSSProperties
  placeholder?: string | null
  dataAttributes?: Record<`data-${string}`, string>
  src?: string | null | undefined
  srcset?: string | null | undefined
}

export interface ImageProps extends Omit<ResponsiveImageProps, 'id' | 'alt' | 'src' | 'srcset' | 'placeholder'> {
  id: string | number
  image?: ImageRenderIntent
  blur?: BlurRenderIntent
}

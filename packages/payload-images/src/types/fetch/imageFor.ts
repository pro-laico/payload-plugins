import type { Fit, Format } from '../transform/format'
import type { PlaceholderQuality } from '../../lib/placeholders/qualities'
import type { AspectRatio, ImageRenderContext, ResponsiveImageDoc } from '../plugin/renderIntent'

export type ImageSource = string | number | { id: string | number } | null | undefined

export type ImageFor = (source: ImageSource, render?: ImageRenderContext) => ImageForChain

export interface ImageForChain {
  aspectRatio(ratio: AspectRatio): ImageForChain
  quality(quality: number): ImageForChain
  fit(fit: Fit): ImageForChain
  format(format: Format): ImageForChain
  blur(quality: PlaceholderQuality): ImageForChain
  fetch(): Promise<ResponsiveImageDoc | null>
}

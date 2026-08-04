import type { ImagesPluginOptions } from './options'
import type { OutputFormat } from '../transform/format'
import type { ResolvedPrewarmStrategy } from '../prewarm/strategy'
import type { TransformConstraints } from '../transform/transformConstraints'

export interface PayloadImagesPrewarmMarker {
  profilesSlug: string
  taskSlug: string
  strategy: ResolvedPrewarmStrategy
  formats: OutputFormat[]
  maxVariantsPerImage: number
  constraints: TransformConstraints
}

export interface PayloadImagesMarker {
  options: ImagesPluginOptions
  sourceSlug: string
  variantSlug: string
  basePath: string
  pixelStep: number | number[]
  maxInputPixels: number
  prewarm?: PayloadImagesPrewarmMarker
}

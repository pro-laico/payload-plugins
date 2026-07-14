import type { OutputFormat } from '../transform/format'
import type { RenderProfileSeed } from '../prewarm/options'
import type { TransformConstraints } from '../transform/transformConstraints'

export interface PayloadImagesPrewarmMarker {
  profilesSlug: string
  taskSlug: string
  queue: string
  formats: OutputFormat[]
  maxVariantsPerImage: number
  seeds: RenderProfileSeed[]
  constraints: TransformConstraints
}

export interface PayloadImagesMarker {
  sourceSlug?: string
  variantSlug?: string
  basePath?: string
  pixelStep?: number | number[]
  prewarm?: PayloadImagesPrewarmMarker
}

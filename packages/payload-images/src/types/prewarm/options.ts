import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'

export interface RenderProfileSeed {
  aspectRatio?: AspectRatio
  fit?: Fit
  quality?: number
  widths?: number[]
}

export interface PrewarmOptions {
  seeds?: RenderProfileSeed[]
  formats?: OutputFormat[]
  maxVariantsPerImage?: number
  autoRun?: string | false
  queue?: string
}

export interface ResolvedPrewarmOptions {
  seeds: RenderProfileSeed[]
  formats: OutputFormat[]
  maxVariantsPerImage: number
  autoRun: string | false
  queue: string
  profilesSlug: string
  taskSlug: string
}

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
  /** Formats to warm per target (default `['webp']`, plus `'avif'` when `transform.preferAvif`).
   * Intersected with `transform.formats` — unservable entries are dropped with a boot warning.
   * An explicit `[]` means "no format expansion" and is honored. */
  formats?: OutputFormat[]
  maxVariantsPerImage?: number
  autoRun?: string | false
  queue?: string
}

export interface ResolvedPrewarmOptions {
  seeds: RenderProfileSeed[]
  formats: OutputFormat[]
  /** Requested formats that transform.formats can never serve — surfaced as an onInit warning. */
  droppedFormats: OutputFormat[]
  maxVariantsPerImage: number
  autoRun: string | false
  queue: string
  profilesSlug: string
  taskSlug: string
}

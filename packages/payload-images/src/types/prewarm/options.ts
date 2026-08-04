import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'
import type { PrewarmStrategy, ResolvedPrewarmStrategy } from './strategy'

export interface RenderProfileSeed {
  /** The crop to warm. */
  aspectRatio?: AspectRatio
  /** How the crop fills the box. */
  fit?: Fit
  /** Quality to warm at. */
  quality?: number
  /** Widths to warm for this profile. */
  widths?: number[]
}

export interface PrewarmOptions {
  /** How targets are derived and when they run: `'default'` or an inline strategy config.
   *
   * - `widths`
   * - `builtIns`
   * - `learned`
   * - `seeds`
   * - `onUpload`
   * - `autoRun`
   * - `queue` */
  strategy?: PrewarmStrategy
  /** Formats to warm per target (default `['webp']`, plus `'avif'` when `transform.preferAvif`).
   * Intersected with `transform.formats` — unservable entries are dropped with a boot warning.
   * An explicit `[]` means "no format expansion" and is honored. */
  formats?: OutputFormat[]
  /** Cap on variants warmed per image, so one image can't consume a run. */
  maxVariantsPerImage?: number
}

export interface ResolvedPrewarmOptions {
  strategy: ResolvedPrewarmStrategy
  formats: OutputFormat[]
  /** Requested formats that transform.formats can never serve — surfaced as an onInit warning. */
  droppedFormats: OutputFormat[]
  maxVariantsPerImage: number
  profilesSlug: string
  taskSlug: string
}

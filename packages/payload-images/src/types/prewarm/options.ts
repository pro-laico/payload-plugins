import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'

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
  /** Renders to warm before the site has served any, so a new project isn't cold.
   *
   * - `aspectRatio`
   * - `fit`
   * - `quality`
   * - `widths` */
  seeds?: RenderProfileSeed[]
  /** Formats to warm per target (default `['webp']`, plus `'avif'` when `transform.preferAvif`).
   * Intersected with `transform.formats` — unservable entries are dropped with a boot warning.
   * An explicit `[]` means "no format expansion" and is honored. */
  formats?: OutputFormat[]
  /** Cap on variants warmed per image, so one image can't consume a run. */
  maxVariantsPerImage?: number
  /** Cron for the built-in runner; `false` means you run the job yourself. */
  autoRun?: string | false
  /** Payload Jobs queue the prewarm task is enqueued on. */
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

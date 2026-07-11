/** Smart-prewarm options: learn served render profiles, warm new/changed images via Payload Jobs. */
import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'

/** A pinned render profile for cold start — the same vocabulary a read declares via `context.image`. */
export interface RenderProfileSeed {
  /** Omit for the image's natural ratio. */
  aspectRatio?: AspectRatio
  /** Default `cover`. */
  fit?: Fit
  /** Default 75 (bucketed to 5s and clamped, exactly like the endpoint). */
  quality?: number
  /** Widths to warm for this profile. Omit → observed widths for the matching profile, else the built-in fallback ladder. */
  widths?: number[]
}

export interface PrewarmOptions {
  /** Profiles warmed even before any traffic has been observed. */
  seeds?: RenderProfileSeed[]
  /** Concrete formats `fmt=auto` observations expand into. Default `['webp']` (+`'avif'` when `transform.preferAvif`). */
  formats?: OutputFormat[]
  /** Hard cap on variants generated per image per job run. Default 24. */
  maxVariantsPerImage?: number
  /** Cron for an in-process runner wired into `config.jobs.autoRun` (e.g. every other minute).
   *  Default `false` — running jobs stays the app's business. Not for serverless. */
  autoRun?: string | false
  /** Jobs queue name. Default `default`, so an app's existing runner picks prewarm work up. */
  queue?: string
}

/** {@link PrewarmOptions} normalized with every default applied, plus the wiring identifiers. */
export interface ResolvedPrewarmOptions {
  seeds: RenderProfileSeed[]
  formats: OutputFormat[]
  maxVariantsPerImage: number
  autoRun: string | false
  queue: string
  profilesSlug: string
  taskSlug: string
}

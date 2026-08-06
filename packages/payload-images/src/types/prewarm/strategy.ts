import type { RenderProfileSeed } from './options'

/** The width axis a strategy warms. Ratios come from built-ins/seeds/learned profiles; formats from `prewarm.formats`. */
export type PrewarmWidths =
  /** Exactly the widths `srcset` emits for this source: the pixelStep ladder capped by source width. */
  | 'srcset'
  /** Every Nth reachable width — the endpoint's snap grid unioned with the width ladder — sampled
   * descending from the largest width the source supports, so the LCP-critical top rung is never
   * skipped. `{ every: 1 }` warms every width the endpoint can ever emit. */
  | { every: number }
  /** Explicit widths, replayed through the endpoint's own snap. */
  | number[]

/** What a prewarm run should do, and when it runs. `'default'` is `{}` written out:
 * srcset-ladder widths, built-ins, learned profiles, enqueue on upload. */
export interface PrewarmStrategyConfig {
  /** The width axis seeds and learned profiles warm at when they don't carry their own widths.
   * Defaults to `'srcset'` with an array `pixelStep` (a small fixed ladder), and `{ every: 5 }`
   * with a numeric grid (a skeleton — the fallback bridges the in-between widths). */
  widths?: PrewarmWidths
  /** Warm the three renders every read implies: `src`, `thumbnailURL`, `placeholderURL` (default `true`). */
  builtIns?: boolean
  /** Warm learned render profiles at their observed widths (default `true`). */
  learned?: boolean
  /** Renders to warm before the site has served any, so a new project isn't cold. Defaults to one
   * square seed, `[{ aspectRatio: '1:1', quality: 80 }]`, at the strategy's width axis — declaring
   * your own seeds replaces it (an explicit `[]` disables seeding). */
  seeds?: RenderProfileSeed[]
  /** Enqueue a prewarm job when an image is created, its file replaced, or its focal edited (default `true`). */
  onUpload?: boolean
  /** Whether — and on long-lived processes, how often — the plugin runs its own jobs. The cron
   * (default: every 5 minutes) drives the in-process runner, which never fires reliably on
   * serverless; there the same knob keeps two request-scoped runners alive instead: every upload
   * kicks the queue after its response, and image traffic drains a few queued jobs per minute.
   * `false` turns all three off — you run the jobs yourself. */
  autoRun?: string | false
  /** Max jobs (one image each) the autoRun cron — and the post-upload kick — executes per firing
   * (default `50` — with the 5-minute default cron, up to 10 images a minute). */
  autoRunLimit?: number
  /** Payload Jobs queue prewarm jobs land on (default `'images-prewarm'` — a plugin-owned queue,
   * so the plugin's runners — cron, upload kicks, traffic drains, the admin Run-now kick — can
   * never execute the app's own jobs). */
  queue?: string
}

export type PrewarmStrategy = 'default' | PrewarmStrategyConfig

export interface ResolvedPrewarmStrategy {
  widths: PrewarmWidths
  builtIns: boolean
  learned: boolean
  seeds: RenderProfileSeed[]
  onUpload: boolean
  autoRun: string | false
  autoRunLimit: number
  queue: string
}

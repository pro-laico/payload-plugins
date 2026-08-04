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
  /** Cron for the built-in in-process runner; `false` means you run the jobs yourself (default `false`). */
  autoRun?: string | false
  /** Payload Jobs queue prewarm jobs land on (default `'default'`). */
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
  queue: string
}

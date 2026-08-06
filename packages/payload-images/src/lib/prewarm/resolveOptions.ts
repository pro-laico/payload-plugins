import { ENCODABLE_FORMATS } from '../transform/params'
import { IMAGE_RENDER_PROFILES_SLUG } from '../../collections/renderProfiles'
import type {
  OutputFormat,
  PrewarmOptions,
  RenderProfileSeed,
  ResolvedPrewarmOptions,
  ResolvedPrewarmStrategy,
  TransformConstraints,
} from '../../types'

export const PREWARM_TASK_SLUG = 'imagesPrewarm'

// Pages serve DECLARED crops, not the upload's native ratio — so the default warm is a seed, not a
// natural-ratio ladder: a square q80 crop at the strategy's derived widths. Declaring your own
// seeds replaces it (an explicit [] means none).
const DEFAULT_PREWARM_SEEDS: RenderProfileSeed[] = [{ aspectRatio: '1:1', quality: 80 }]

// On by default: these sites are image-led marketing pages where a cold variant is a visible LCP hit.
// Only an explicit `prewarm: false` opts out — note that being on registers the render-profiles
// collection (a schema change) and the jobs task. The default strategy also runs the jobs with
// zero wiring on any host: a 5-minute autoRun cron on the plugin-owned 'images-prewarm' queue for
// long-lived processes (dev servers included), plus — because in-process crons never fire reliably
// on serverless — a post-response kick after every upload and a throttled drain on image traffic.
export const resolvePrewarmOptions = (
  opts: false | PrewarmOptions,
  constraints: TransformConstraints,
  profilesSlug: string = IMAGE_RENDER_PROFILES_SLUG,
): ResolvedPrewarmOptions | false => {
  if (opts === false) return false
  const raw = opts
  const strategyConfig = raw.strategy == null || raw.strategy === 'default' ? {} : raw.strategy
  const strategy: ResolvedPrewarmStrategy = {
    // An array pixelStep emits a small fixed srcset — warm it exactly. A numeric grid emits a dense
    // srcset (one URL per step), so warm a skeleton instead: every 5th reachable width (~250px at
    // the default 50px grid) — the fallback serves the in-between widths from a warm neighbor.
    widths: strategyConfig.widths ?? (constraints.widthLadder?.length ? 'srcset' : { every: 5 }),
    builtIns: strategyConfig.builtIns ?? true,
    learned: strategyConfig.learned ?? true,
    seeds: strategyConfig.seeds ?? DEFAULT_PREWARM_SEEDS,
    onUpload: strategyConfig.onUpload ?? true,
    // 50 jobs (one image each) per 5-minute firing = up to 10 images a minute.
    autoRun: strategyConfig.autoRun ?? '*/5 * * * *',
    autoRunLimit: strategyConfig.autoRunLimit ?? 50,
    // A plugin-owned queue: the default cron and the Run-now kick only ever run OUR jobs.
    queue: strategyConfig.queue ?? 'images-prewarm',
  }
  const defaultFormats: OutputFormat[] = constraints.preferAvif ? ['webp', 'avif'] : ['webp']
  // Only formats the endpoint can actually serve are worth warming — anything outside
  // transform.formats would be generated, stored, and never matched by a request key.
  const servable = ENCODABLE_FORMATS.filter((f) => constraints.formats.includes(f))
  const requested = raw.formats ?? defaultFormats
  const formats = requested.filter((f) => servable.includes(f))
  const droppedFormats = requested.filter((f) => !servable.includes(f))
  const fallback = defaultFormats.filter((f) => servable.includes(f))
  return {
    strategy,
    // An explicit empty array means "warm no extra formats" and is honored; a fully-dropped
    // explicit list falls back to the servable defaults (droppedFormats drives an onInit warning).
    formats: formats.length || !droppedFormats.length ? formats : fallback.length ? fallback : servable.slice(0, 1),
    droppedFormats,
    // The default strategy with preferAvif already yields ~24 targets (built-ins + srcset ladder,
    // two formats each) — 24 would starve learned profiles entirely.
    maxVariantsPerImage: raw.maxVariantsPerImage ?? 32,
    profilesSlug,
    taskSlug: PREWARM_TASK_SLUG,
  }
}

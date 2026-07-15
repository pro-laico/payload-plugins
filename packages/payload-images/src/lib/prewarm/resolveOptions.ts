import { ENCODABLE_FORMATS } from '../transform/params'
import { IMAGE_RENDER_PROFILES_SLUG } from '../../collections/renderProfiles'
import type { ImagesPluginOptions, OutputFormat, ResolvedPrewarmOptions, TransformConstraints } from '../../types'

export const PREWARM_TASK_SLUG = 'imagesPrewarm'

export const resolvePrewarmOptions = (opts: ImagesPluginOptions, constraints: TransformConstraints): ResolvedPrewarmOptions | false => {
  if (!opts.prewarm) return false
  const raw = opts.prewarm === true ? {} : opts.prewarm
  const defaultFormats: OutputFormat[] = constraints.preferAvif ? ['webp', 'avif'] : ['webp']
  // Only formats the endpoint can actually serve are worth warming — anything outside
  // transform.formats would be generated, stored, and never matched by a request key.
  const servable = ENCODABLE_FORMATS.filter((f) => constraints.formats.includes(f))
  const requested = raw.formats ?? defaultFormats
  const formats = requested.filter((f) => servable.includes(f))
  const droppedFormats = requested.filter((f) => !servable.includes(f))
  const fallback = defaultFormats.filter((f) => servable.includes(f))
  return {
    seeds: raw.seeds ?? [],
    // An explicit empty array means "warm no extra formats" and is honored; a fully-dropped
    // explicit list falls back to the servable defaults (droppedFormats drives an onInit warning).
    formats: formats.length || !droppedFormats.length ? formats : fallback.length ? fallback : servable.slice(0, 1),
    droppedFormats,
    maxVariantsPerImage: raw.maxVariantsPerImage ?? 24,
    autoRun: raw.autoRun ?? false,
    queue: raw.queue ?? 'default',
    profilesSlug: IMAGE_RENDER_PROFILES_SLUG,
    taskSlug: PREWARM_TASK_SLUG,
  }
}

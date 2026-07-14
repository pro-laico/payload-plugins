import { IMAGE_RENDER_PROFILES_SLUG } from '../../collections/renderProfiles'
import type { ImagesPluginOptions, OutputFormat, ResolvedPrewarmOptions } from '../../types'

export const PREWARM_TASK_SLUG = 'imagesPrewarm'

export const resolvePrewarmOptions = (opts: ImagesPluginOptions): ResolvedPrewarmOptions | false => {
  if (!opts.prewarm) return false
  const raw = opts.prewarm === true ? {} : opts.prewarm
  const preferAvif = opts.transform !== false && opts.transform?.preferAvif === true
  const defaultFormats: OutputFormat[] = preferAvif ? ['webp', 'avif'] : ['webp']
  return {
    seeds: raw.seeds ?? [],
    formats: raw.formats?.length ? raw.formats : defaultFormats,
    maxVariantsPerImage: raw.maxVariantsPerImage ?? 24,
    autoRun: raw.autoRun ?? false,
    queue: raw.queue ?? 'default',
    profilesSlug: IMAGE_RENDER_PROFILES_SLUG,
    taskSlug: PREWARM_TASK_SLUG,
  }
}

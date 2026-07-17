import type { CollectionConfig, Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { createPrewarmTask } from './jobs/prewarmTask'
import { createPurgeEndpoint } from './endpoints/purge'
import { createPrewarmStatusEndpoint, createPrewarmTriggerEndpoint } from './endpoints/prewarm'
import { createPresetStatusEndpoint } from './endpoints/presets'
import { assertNoFieldCollisions, binScriptPath, mergeCollection } from './_kit'
import { loadSharp } from './lib/transform/sharpInstance'
import { createImagesCollection, IMAGES_SLUG } from './collections/images'
import { resolveConstraints } from './endpoints/transform/config'
import { resolvePrewarmOptions } from './lib/prewarm/resolveOptions'
import { SHARP_INSTALL_HINT } from './lib/transform/getVariantBytes'
import { type RatioCandidate, ratioToken } from './lib/prewarm/profileKey'
import { parseAspectRatio } from './lib/transform/params'
import { createRenderProfilesCollection, IMAGE_RENDER_PROFILES_SLUG } from './collections/renderProfiles'
import { createTransformEndpoint, type PrewarmObserveConfig } from './endpoints/transform'
import type { ImagesPluginOptions, PayloadImagesMarker } from './types'
import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'

type JobsCfg = NonNullable<Config['jobs']>

const withAutoRun = (existing: JobsCfg['autoRun'], cron: string, queue: string): JobsCfg['autoRun'] => {
  const entry = { cron, queue, limit: 10 }
  if (!existing) return [entry]
  if (Array.isArray(existing)) return [...existing, entry]
  return async (payload) => [...(await existing(payload)), entry]
}

/** On-demand image optimization: upload a picture once, then ask for any size, crop, or
 * format by URL. Variants generate on first request and are cached.
 *
 * - `enabled`
 * - `collections`
 * - `options`
 */
export const imagesPlugin =
  (opts: ImagesPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const o = resolveOptions(opts, { localized: Boolean(config.localization) })
    if (!o.enabled) return config

    // Both slugs resolve ONCE, here: `collections.<name>.slug` renames the collection via
    // mergeCollection, and every internal reference below is threaded from these two constants.
    const sourceSlug = o.collections.images.slug ?? IMAGES_SLUG
    const variantSlug = o.collections.generatedImages.slug ?? GENERATED_IMAGES_SLUG
    const profilesSlug = o.collections.renderProfiles.slug ?? IMAGE_RENDER_PROFILES_SLUG
    const basePath = '/img'
    const purgePath = `${basePath}/purge`
    const prewarmPath = `${basePath}/prewarm`
    const presetsPath = `${basePath}/presets`
    const apiRoute = config.routes?.api ?? '/api'

    // A numeric pixelStep IS the snap grid; an array becomes the snap's width ladder. Resolved
    // exactly like the endpoint resolves them, so prewarm's replayed params — and therefore its
    // cache keys — match organic traffic byte for byte.
    const snapping = Array.isArray(o.options.pixelStep) ? { widthLadder: o.options.pixelStep } : { dimensionStep: o.options.pixelStep }
    const constraints = resolveConstraints({ ...o.options.transform, ...snapping })
    // The cap + eager-gen hook + endpoint all share one resolved template set.
    const presetTemplates = o.options.presetTemplates
    const presetGen = { sourceSlug, variantSlug, templates: presetTemplates, constraints }
    const imageOpts = { presetTemplates, variantLimit: o.options.variantLimit, presetGen }
    const prewarm = resolvePrewarmOptions(o.options.prewarm, constraints, profilesSlug)
    const prewarmDeps = prewarm
      ? {
          sourceSlug,
          variantSlug,
          profilesSlug: prewarm.profilesSlug,
          seeds: prewarm.seeds,
          formats: prewarm.formats,
          maxVariantsPerImage: prewarm.maxVariantsPerImage,
          constraints,
        }
      : undefined
    const prewarmObserve: PrewarmObserveConfig | undefined = prewarm
      ? {
          profilesSlug: prewarm.profilesSlug,
          seedCandidates: prewarm.seeds.flatMap((s): RatioCandidate[] => {
            const ratio = s.aspectRatio != null ? parseAspectRatio(s.aspectRatio) : undefined
            return ratio ? [{ token: ratioToken(ratio), ratio }] : []
          }),
        }
      : undefined

    // `slug` is a direct key on each collection option now, resolved into the *Slug constants above;
    // it's threaded into each base here so the collection is registered under the renamed slug.
    const generatedBase = createGeneratedImagesCollection({ slug: variantSlug, sourceSlug })
    assertNoFieldCollisions('payload-images', 'generatedImages', generatedBase.fields, o.collections.generatedImages.overrides?.fields)
    const generated = mergeCollection(generatedBase, o.collections.generatedImages.overrides)

    const imgOpts = o.collections.images.options
    const imagesBase = createImagesCollection({
      focalUI: imgOpts.focalUI !== false,
      previewRatios: imgOpts.focalUI ? imgOpts.focalUI.previewRatios : undefined,
      variantSlug,
      purgePath,
      localizeAlt: imgOpts.localizeAlt,
      mimeTypes: imgOpts.mimeTypes,
      folders: imgOpts.folders,
      maxOriginalSize: imgOpts.maxOriginalSize,
      apiRoute,
      presetsPath,
      prewarm: prewarm ? { taskSlug: prewarm.taskSlug, queue: prewarm.queue } : false,
      // Its presence is the panel's prewarm-UI gate.
      ...(prewarm ? { prewarmPath } : {}),
      ...imageOpts,
    })
    assertNoFieldCollisions('payload-images', 'images', imagesBase.fields, o.collections.images.overrides?.fields)
    const images = mergeCollection({ ...imagesBase, slug: sourceSlug }, o.collections.images.overrides)

    const collections: CollectionConfig[] = [...(config.collections ?? []), images, generated]
    if (prewarm) {
      const profilesBase = createRenderProfilesCollection({ slug: profilesSlug })
      assertNoFieldCollisions('payload-images', 'renderProfiles', profilesBase.fields, o.collections.renderProfiles.overrides?.fields)
      collections.push(mergeCollection(profilesBase, o.collections.renderProfiles.overrides))
    }

    const endpoints = [
      ...(config.endpoints ?? []),
      createPurgeEndpoint({ variantSlug, sourceSlug }),
      createPresetStatusEndpoint({ sourceSlug, variantSlug, templates: presetTemplates, constraints }),
      ...(prewarm && prewarmDeps
        ? [
            createPrewarmStatusEndpoint({ deps: prewarmDeps, taskSlug: prewarm.taskSlug, queue: prewarm.queue }),
            createPrewarmTriggerEndpoint({ deps: prewarmDeps, taskSlug: prewarm.taskSlug, queue: prewarm.queue }),
          ]
        : []),
      createTransformEndpoint(
        { ...o.options.transform, ...snapping, variantSlug, sourceSlug, variantLimit: o.options.variantLimit, presetTemplates },
        prewarmObserve,
      ),
    ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = collections.some((c) => c.slug === baseSegment)

    const marker: PayloadImagesMarker = {
      options: opts,
      sourceSlug,
      variantSlug,
      basePath,
      pixelStep: o.options.pixelStep,
      maxInputPixels: constraints.maxInputPixels,
      ...(prewarm
        ? {
            prewarm: {
              profilesSlug: prewarm.profilesSlug,
              taskSlug: prewarm.taskSlug,
              queue: prewarm.queue,
              formats: prewarm.formats,
              maxVariantsPerImage: prewarm.maxVariantsPerImage,
              seeds: prewarm.seeds,
              constraints,
            },
          }
        : {}),
    }

    return {
      ...config,
      collections,
      bin: [
        ...(config.bin ?? []),
        { key: 'images:backfill', scriptPath: binScriptPath(import.meta.url, 'imagesBackfill') },
        ...(prewarm ? [{ key: 'images:prewarm', scriptPath: binScriptPath(import.meta.url, 'imagesPrewarm') }] : []),
      ],
      endpoints,
      ...(prewarm && prewarmDeps
        ? {
            jobs: {
              ...config.jobs,
              //EXCUSE: TypedJobs task slugs are app-generated; the plugin can't name its own task slug in that union
              tasks: [...(config.jobs?.tasks ?? []), createPrewarmTask(prewarmDeps) as never],
              ...(prewarm.autoRun ? { autoRun: withAutoRun(config.jobs?.autoRun, prewarm.autoRun, prewarm.queue) } : {}),
            },
          }
        : {}),
      custom: { ...config.custom, payloadImages: marker },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        if (shadowed)
          payload.logger.warn(
            `[payload-images] a collection is named "${baseSegment}", which shadows the transform endpoint at /api/${baseSegment} — rename the collection so it doesn't collide.`,
          )
        if (prewarm && prewarm.droppedFormats.length)
          payload.logger.warn(
            `[payload-images] prewarm.formats: ${prewarm.droppedFormats.join(', ')} not in transform.formats — the endpoint could never serve those variants, so they are not warmed. Warming: ${prewarm.formats.join(', ') || 'none'}.`,
          )
        try {
          await loadSharp()
        } catch (err) {
          payload.logger.error(
            `[payload-images] sharp failed to load — transforms and LQIPs will fail; ${SHARP_INSTALL_HINT}. (${String(err)})`,
          )
        }
      },
    }
  }

export default imagesPlugin

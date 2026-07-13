import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { stashConfig } from './lib/configStash'
import { loadSharp } from './lib/transform/sharpInstance'
import { createPurgeEndpoint } from './endpoints/purge'
import { createImagesCollection } from './collections/images'
import { imageEnhancements } from './collections/images/imageEnhancements'
import { mergeCollection } from './lib/mergeCollection'
import { SHARP_INSTALL_HINT } from './lib/transform/getVariantBytes'
import { DEFAULT_PIXEL_STEP, parseAspectRatio } from './lib/transform/params'
import { createTransformEndpoint, type PrewarmObserveConfig } from './endpoints/transform'
import { resolveConstraints } from './endpoints/transform/config'
import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'
import { createRenderProfilesCollection } from './collections/renderProfiles'
import { resolvePrewarmOptions } from './lib/prewarm/resolveOptions'
import { DEFAULT_VARIANT_LIMIT, resolvePresetTemplates } from './lib/presets/defaults'
import { type RatioCandidate, ratioToken } from './lib/prewarm/profileKey'
import { createPrewarmTask } from './jobs/prewarmTask'
import type { ImagesPluginOptions, TransformEndpointConfig } from './types'

type JobsCfg = NonNullable<Config['jobs']>

/** Compose the prewarm autorun cron onto whatever `config.jobs.autoRun` shape the app already has. */
const withAutoRun = (existing: JobsCfg['autoRun'], cron: string, queue: string): JobsCfg['autoRun'] => {
  const entry = { cron, queue, limit: 10 }
  if (!existing) return [entry]
  if (Array.isArray(existing)) return [...existing, entry]
  return async (payload) => [...(await existing(payload)), entry]
}

/** Absolute path to a bundled bin script, resolving the src→dist swap from this module's own
 *  location so `payload <key>` works both in-workspace and when published. */
const binScriptPath = (name: string): string => {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

/**
 * Registers the `images` (source) and hidden `generated-images` (variant cache) collections,
 * plus the on-demand transform + purge endpoints. Uploads store only the original; every
 * rendered size is generated on first request (focal-cropped), then cached. Placeholders are a
 * quality-tier ladder stored on the doc at upload; the virtual `placeholder` serves each
 * read a finished, focal-cropped placeholder. The transform endpoint mounts at `/api/img`; do
 * not name a collection `img` or it shadows the endpoint.
 */
export const imagesPlugin =
  (opts: ImagesPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      extendCollection,
      imagesOverrides,
      generatedImagesOverrides,
      pixelStep = DEFAULT_PIXEL_STEP,
      transform = {},
      focalUI: focalUIOpt = true,
      localizeAlt = false,
      mimeTypes,
      folders,
      maxOriginalSize,
    } = opts
    if (!enabled) return config

    const focalUI = focalUIOpt !== false
    const previewRatios = typeof focalUIOpt === 'object' ? focalUIOpt.previewRatios : undefined
    const transformCfg: TransformEndpointConfig = transform === false ? {} : transform
    const variantSlug = GENERATED_IMAGES_SLUG
    const sourceSlug = extendCollection || 'images'
    const basePath = '/img'
    const purgePath = `${basePath}/purge`
    const apiRoute = config.routes?.api ?? '/api'
    const endpointsEnabled = transform !== false
    const virtualFields = opts.virtualFields ?? endpointsEnabled

    // A numeric pixelStep IS the snap grid; an array becomes the snap's width ladder. Resolved
    // exactly like the endpoint resolves them, so prewarm's replayed params — and therefore its
    // cache keys — match organic traffic byte for byte.
    const snapping = Array.isArray(pixelStep) ? { widthLadder: pixelStep } : { dimensionStep: pixelStep }
    const constraints = resolveConstraints({ ...transformCfg, ...snapping })
    // Presets: default `og` merged under any user templates; the cap + eager-gen hook + endpoint all share these.
    const presetTemplates = resolvePresetTemplates(opts.presetTemplates)
    const variantLimit = opts.variantLimit ?? DEFAULT_VARIANT_LIMIT
    const presetGen: import('./hooks/collection/generatePresets').GeneratePresetsOptions | false = endpointsEnabled
      ? { sourceSlug, variantSlug, templates: presetTemplates, constraints }
      : false
    const imageOpts = { presetTemplates, variantLimit, presetGen }
    const prewarm = resolvePrewarmOptions(opts)
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

    const generated = mergeCollection(createGeneratedImagesCollection({ slug: variantSlug, sourceSlug }), generatedImagesOverrides)

    let collections: CollectionConfig[]
    if (extendCollection) {
      const target = (config.collections ?? []).find((c) => c.slug === extendCollection)
      if (!target) throw new Error(`[payload-images] extendCollection: collection '${extendCollection}' not found`)
      if (!target.upload) throw new Error(`[payload-images] extendCollection: collection '${extendCollection}' is not an upload collection`)
      const ownThumbnail =
        (typeof target.upload === 'object' && !!target.upload.adminThumbnail) ||
        !!(target.admin as { thumbnail?: unknown } | undefined)?.thumbnail
      const enh = imageEnhancements({
        focalUI,
        previewRatios,
        variantSlug,
        purgePath,
        virtualFields,
        folders,
        apiRoute,
        endpointsEnabled,
        adminThumbnail: !endpointsEnabled || ownThumbnail ? false : undefined,
        prewarm: prewarm ? { taskSlug: prewarm.taskSlug, queue: prewarm.queue } : false,
        ...imageOpts,
      })
      // Re-merge the target's own populate/select on top so the enhancements never clobber them.
      const parity: Partial<CollectionConfig> = {
        ...enh,
        defaultPopulate: {
          ...(enh.defaultPopulate as Record<string, unknown>), //EXCUSE: Payload's per-collection select generics don't exist inside the plugin
          ...(target.defaultPopulate as Record<string, unknown> | undefined), //EXCUSE: same as above
        } as CollectionConfig['defaultPopulate'], //EXCUSE: same as above
        ...(enh.forceSelect || target.forceSelect
          ? {
              forceSelect: {
                ...(enh.forceSelect as Record<string, unknown> | undefined), //EXCUSE: same as defaultPopulate above
                ...(target.forceSelect as Record<string, unknown> | undefined), //EXCUSE: same as defaultPopulate above
              } as CollectionConfig['forceSelect'], //EXCUSE: same as defaultPopulate above
            }
          : {}),
      }
      const enhanced = mergeCollection(mergeCollection(target, parity), imagesOverrides)
      collections = [...(config.collections ?? []).filter((c) => c.slug !== extendCollection), enhanced, generated]
    } else {
      const images = mergeCollection(
        createImagesCollection({
          focalUI,
          previewRatios,
          variantSlug,
          purgePath,
          virtualFields,
          localizeAlt,
          mimeTypes,
          folders,
          maxOriginalSize,
          apiRoute,
          endpointsEnabled,
          adminThumbnail: endpointsEnabled ? undefined : false,
          prewarm: prewarm ? { taskSlug: prewarm.taskSlug, queue: prewarm.queue } : false,
          ...imageOpts,
        }),
        imagesOverrides,
      )
      collections = [...(config.collections ?? []), images, generated]
    }
    if (prewarm) collections.push(createRenderProfilesCollection())

    const endpoints =
      transform === false
        ? config.endpoints
        : [
            ...(config.endpoints ?? []),
            createPurgeEndpoint({ variantSlug, sourceSlug }),
            createTransformEndpoint({ ...transformCfg, ...snapping, variantSlug, sourceSlug, variantLimit, presetTemplates }, prewarmObserve),
          ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = transform !== false && collections.some((c) => c.slug === baseSegment)
    const ignoredWithExtend = extendCollection
      ? (['mimeTypes', 'localizeAlt', 'maxOriginalSize'] as const).filter((k) => opts[k] !== undefined)
      : []

    return {
      ...config,
      collections,
      bin: [
        ...(config.bin ?? []),
        { key: 'images:backfill', scriptPath: binScriptPath('imagesBackfill') },
        ...(prewarm ? [{ key: 'images:prewarm', scriptPath: binScriptPath('imagesPrewarm') }] : []),
      ],
      endpoints,
      ...(prewarm && prewarmDeps
        ? {
            jobs: {
              ...config.jobs,
              tasks: [...(config.jobs?.tasks ?? []), createPrewarmTask(prewarmDeps) as never], //EXCUSE: TypedJobs task slugs are app-generated; the plugin can't name its own slug in that union
              ...(prewarm.autoRun ? { autoRun: withAutoRun(config.jobs?.autoRun, prewarm.autoRun, prewarm.queue) } : {}),
            },
          }
        : {}),
      custom: {
        ...config.custom,
        payloadImages: {
          options: opts,
          sourceSlug,
          variantSlug,
          basePath,
          pixelStep,
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
        },
      },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        stashConfig(payload.config)
        if (shadowed)
          payload.logger.warn(
            `[payload-images] a collection is named "${baseSegment}", which shadows the transform endpoint at /api/${baseSegment} — rename the collection so it doesn't collide.`,
          )
        if (ignoredWithExtend.length)
          payload.logger.warn(
            `[payload-images] extendCollection: option(s) ${ignoredWithExtend.join(', ')} are ignored — you own '${extendCollection}'s upload config; set the equivalent on the collection itself.`,
          )
        if (!endpointsEnabled && opts.virtualFields === true)
          payload.logger.warn(
            '[payload-images] virtualFields: true with transform: false — the virtual src/srcset/placeholderURL/thumbnailURL fields point at the unregistered transform endpoint and will 404.',
          )
        if (prewarm && !endpointsEnabled)
          payload.logger.warn(
            '[payload-images] prewarm with transform: false — nothing serves (or observes) variants, so only seeded profiles are meaningful and warmed bytes are unreachable. Enable the transform endpoint or drop prewarm.',
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

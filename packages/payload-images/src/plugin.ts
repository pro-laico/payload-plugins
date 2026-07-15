import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { createPrewarmTask } from './jobs/prewarmTask'
import { createPurgeEndpoint } from './endpoints/purge'
import { createPrewarmStatusEndpoint, createPrewarmTriggerEndpoint } from './endpoints/prewarm'
import { createPresetStatusEndpoint } from './endpoints/presets'
import { mergeSelect } from './lib/mergeCollection/mergeSelect'
import { mergeCollection } from './lib/mergeCollection'
import { loadSharp } from './lib/transform/sharpInstance'
import { createImagesCollection } from './collections/images'
import { resolveConstraints } from './endpoints/transform/config'
import { resolvePrewarmOptions } from './lib/prewarm/resolveOptions'
import { SHARP_INSTALL_HINT } from './lib/transform/getVariantBytes'
import { imageEnhancements } from './collections/images/imageEnhancements'
import { type RatioCandidate, ratioToken } from './lib/prewarm/profileKey'
import type { ImagesPluginOptions, TransformEndpointConfig } from './types'
import { DEFAULT_WIDTH_LADDER, parseAspectRatio } from './lib/transform/params'
import { createRenderProfilesCollection } from './collections/renderProfiles'
import { DEFAULT_VARIANT_LIMIT, resolvePresetTemplates } from './lib/presets/defaults'
import { createTransformEndpoint, type PrewarmObserveConfig } from './endpoints/transform'
import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'

type JobsCfg = NonNullable<Config['jobs']>

const withAutoRun = (existing: JobsCfg['autoRun'], cron: string, queue: string): JobsCfg['autoRun'] => {
  const entry = { cron, queue, limit: 10 }
  if (!existing) return [entry]
  if (Array.isArray(existing)) return [...existing, entry]
  return async (payload) => [...(await existing(payload)), entry]
}

const binScriptPath = (name: string): string => {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

// Data-level field names in an array, recursing only into presentational containers (row,
// collapsible, unnamed tabs) — their children share the parent's level for name uniqueness.
const namedFields = (fields: CollectionConfig['fields']): string[] =>
  fields.flatMap((f) => {
    if ('name' in f && typeof f.name === 'string') return [f.name]
    if ('fields' in f && Array.isArray(f.fields)) return namedFields(f.fields)
    if (f.type === 'tabs') return f.tabs.flatMap((t) => ('name' in t && t.name ? [] : namedFields(t.fields)))
    return []
  })

export const imagesPlugin =
  (opts: ImagesPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      extendCollection,
      imagesOverrides,
      generatedImagesOverrides,
      pixelStep = DEFAULT_WIDTH_LADDER,
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
    const prewarmPath = `${basePath}/prewarm`
    const presetsPath = `${basePath}/presets`
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
    const prewarm = resolvePrewarmOptions(opts, constraints)
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
        !!(target.admin && 'thumbnail' in target.admin && target.admin.thumbnail)
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
        ...(prewarm && endpointsEnabled ? { prewarmPath } : {}),
        ...(endpointsEnabled ? { presetsPath } : {}),
        ...imageOpts,
      })
      // Re-merge the target's own populate/select on top so the enhancements never clobber them.
      const parity: Partial<CollectionConfig> = {
        ...enh,
        defaultPopulate: mergeSelect(enh.defaultPopulate, target.defaultPopulate),
        ...(enh.forceSelect || target.forceSelect ? { forceSelect: mergeSelect(enh.forceSelect, target.forceSelect) } : {}),
      }
      // Fields append on merge, so a target field named like an injected one would boot-fail with
      // Payload's bare DuplicateFieldName — catch it here with a plugin-attributed error instead.
      const injected = new Set(namedFields(parity.fields ?? []))
      const collisions = namedFields(target.fields).filter((n) => injected.has(n))
      if (collisions.length)
        throw new Error(
          `[payload-images] extendCollection: '${extendCollection}' already defines field(s) ${collisions.join(', ')} that the plugin injects — rename or remove them.`,
        )
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
          ...(prewarm && endpointsEnabled ? { prewarmPath } : {}),
          ...(endpointsEnabled ? { presetsPath } : {}),
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
            createPresetStatusEndpoint({ sourceSlug, variantSlug, templates: presetTemplates, constraints }),
            ...(prewarm && prewarmDeps
              ? [
                  createPrewarmStatusEndpoint({ deps: prewarmDeps, taskSlug: prewarm.taskSlug, queue: prewarm.queue }),
                  createPrewarmTriggerEndpoint({ deps: prewarmDeps, taskSlug: prewarm.taskSlug, queue: prewarm.queue }),
                ]
              : []),
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
              //EXCUSE: TypedJobs task slugs are app-generated; the plugin can't name its own task slug in that union
              tasks: [...(config.jobs?.tasks ?? []), createPrewarmTask(prewarmDeps) as never],
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

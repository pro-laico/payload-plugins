import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { resolveOptions } from './options'
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
import { parseAspectRatio } from './lib/transform/params'
import { createRenderProfilesCollection } from './collections/renderProfiles'
import { resolvePresetTemplates } from './lib/presets/defaults'
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

/** On-demand image optimization: upload a picture once, then ask for any size, crop, or
 * format by URL. Variants generate on first request and are cached.
 *
 * - `enabled`
 * - `extendCollection`
 * - `collections`
 * - `admin`
 * - `transform`
 * - `prewarm`
 * - `pixelStep`
 * - `presetTemplates`
 * - `variantLimit`
 * - `localizeAlt`
 * - `mimeTypes`
 * - `maxOriginalSize`
 */
export const imagesPlugin =
  (opts: ImagesPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const o = resolveOptions(opts, { localized: Boolean(config.localization) })
    if (!o.enabled) return config

    const variantSlug = GENERATED_IMAGES_SLUG
    const sourceSlug = o.extendCollection || 'images'
    const basePath = '/img'
    const purgePath = `${basePath}/purge`
    const prewarmPath = `${basePath}/prewarm`
    const presetsPath = `${basePath}/presets`
    const apiRoute = config.routes?.api ?? '/api'

    // A numeric pixelStep IS the snap grid; an array becomes the snap's width ladder. Resolved
    // exactly like the endpoint resolves them, so prewarm's replayed params — and therefore its
    // cache keys — match organic traffic byte for byte.
    const snapping = Array.isArray(o.pixelStep) ? { widthLadder: o.pixelStep } : { dimensionStep: o.pixelStep }
    const constraints = resolveConstraints({ ...o.transform, ...snapping })
    // Presets: default `og` merged under any user templates; the cap + eager-gen hook + endpoint all share these.
    const presetTemplates = resolvePresetTemplates(opts.presetTemplates)
    const presetGen = { sourceSlug, variantSlug, templates: presetTemplates, constraints }
    const imageOpts = { presetTemplates, variantLimit: o.variantLimit, presetGen }
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

    const generated = mergeCollection(createGeneratedImagesCollection({ slug: variantSlug, sourceSlug }), o.generatedImages)

    let collections: CollectionConfig[]
    if (o.extendCollection) {
      const target = (config.collections ?? []).find((c) => c.slug === o.extendCollection)
      if (!target) throw new Error(`[payload-images] extendCollection: collection '${o.extendCollection}' not found`)
      if (!target.upload) throw new Error(`[payload-images] extendCollection: collection '${o.extendCollection}' is not an upload collection`)
      const ownThumbnail =
        (typeof target.upload === 'object' && !!target.upload.adminThumbnail) ||
        !!(target.admin && 'thumbnail' in target.admin && target.admin.thumbnail)
      const enh = imageEnhancements({
        focalUI: o.focalUI,
        previewRatios: o.previewRatios,
        variantSlug,
        purgePath,
        folders: o.folders,
        apiRoute,
        presetsPath,
        adminThumbnail: ownThumbnail ? false : undefined,
        prewarm: prewarm ? { taskSlug: prewarm.taskSlug, queue: prewarm.queue } : false,
        // Its presence is the panel's prewarm-UI gate.
        ...(prewarm ? { prewarmPath } : {}),
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
          `[payload-images] extendCollection: '${o.extendCollection}' already defines field(s) ${collisions.join(', ')} that the plugin injects — rename or remove them.`,
        )
      const enhanced = mergeCollection(mergeCollection(target, parity), o.images)
      collections = [...(config.collections ?? []).filter((c) => c.slug !== o.extendCollection), enhanced, generated]
    } else {
      const images = mergeCollection(
        createImagesCollection({
          focalUI: o.focalUI,
          previewRatios: o.previewRatios,
          variantSlug,
          purgePath,
          localizeAlt: o.localizeAlt,
          mimeTypes: o.mimeTypes,
          folders: o.folders,
          maxOriginalSize: o.maxOriginalSize,
          apiRoute,
          presetsPath,
          prewarm: prewarm ? { taskSlug: prewarm.taskSlug, queue: prewarm.queue } : false,
          ...(prewarm ? { prewarmPath } : {}),
          ...imageOpts,
        }),
        o.images,
      )
      collections = [...(config.collections ?? []), images, generated]
    }
    if (prewarm) collections.push(createRenderProfilesCollection())

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
        { ...o.transform, ...snapping, variantSlug, sourceSlug, variantLimit: o.variantLimit, presetTemplates },
        prewarmObserve,
      ),
    ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = collections.some((c) => c.slug === baseSegment)
    const ignoredWithExtend = o.extendCollection
      ? (['mimeTypes', 'localizeAlt', 'maxOriginalSize'] as const).filter((k) => opts[k] !== undefined)
      : []

    const marker: PayloadImagesMarker = {
      options: opts,
      sourceSlug,
      variantSlug,
      basePath,
      pixelStep: o.pixelStep,
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
      custom: { ...config.custom, payloadImages: marker },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        if (shadowed)
          payload.logger.warn(
            `[payload-images] a collection is named "${baseSegment}", which shadows the transform endpoint at /api/${baseSegment} — rename the collection so it doesn't collide.`,
          )
        if (ignoredWithExtend.length)
          payload.logger.warn(
            `[payload-images] extendCollection: option(s) ${ignoredWithExtend.join(', ')} are ignored — you own '${o.extendCollection}'s upload config; set the equivalent on the collection itself.`,
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

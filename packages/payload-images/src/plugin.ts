import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { stashConfig } from './lib/configStash'
import { loadSharp } from './lib/transform/sharpInstance'
import { createPurgeEndpoint } from './endpoints/purge'
import { createImagesCollection } from './collections/images'
import { imageEnhancements } from './collections/imageEnhancements'
import { mergeCollection } from './collections/mergeCollection'
import { SHARP_INSTALL_HINT } from './lib/transform/getVariantBytes'
import { DEFAULT_CONSTRAINTS, DEFAULT_PIXEL_STEP } from './lib/transform/params'
import { createTransformEndpoint } from './endpoints/transform'
import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'
import type { ImagesPluginOptions, TransformEndpointConfig } from './types'

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
      focalUI = true,
      previewRatios,
      localizeAlt = false,
      mimeTypes,
      folders,
      maxOriginalSize,
    } = opts
    if (!enabled) return config

    const transformCfg: TransformEndpointConfig = transform === false ? {} : transform
    const variantSlug = transformCfg.variantSlug || GENERATED_IMAGES_SLUG
    const sourceSlug = extendCollection || transformCfg.sourceSlug || 'images'
    const basePath = '/img'
    const purgePath = `${basePath}/purge`
    const apiRoute = config.routes?.api ?? '/api'
    const endpointsEnabled = transform !== false
    const virtualFields = opts.virtualFields ?? endpointsEnabled

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
        }),
        imagesOverrides,
      )
      collections = [...(config.collections ?? []), images, generated]
    }

    if (!extendCollection && transformCfg.sourceSlug) {
      const src = collections.find((c) => c.slug === transformCfg.sourceSlug)
      if (!src) throw new Error(`[payload-images] transform.sourceSlug: collection '${transformCfg.sourceSlug}' not found`)
      if (!src.upload)
        throw new Error(`[payload-images] transform.sourceSlug: collection '${transformCfg.sourceSlug}' is not an upload collection`)
    }

    const endpoints =
      transform === false
        ? config.endpoints
        : [
            ...(config.endpoints ?? []),
            createPurgeEndpoint({ variantSlug, sourceSlug }),
            createTransformEndpoint({
              dimensionStep: Array.isArray(pixelStep) ? DEFAULT_PIXEL_STEP : pixelStep,
              ...transformCfg,
              variantSlug,
              sourceSlug,
            }),
          ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = transform !== false && collections.some((c) => c.slug === baseSegment)
    const ignoredWithExtend = extendCollection
      ? (['mimeTypes', 'localizeAlt', 'maxOriginalSize'] as const).filter((k) => opts[k] !== undefined)
      : []

    return {
      ...config,
      collections,
      bin: [...(config.bin ?? []), { key: 'images:backfill', scriptPath: binScriptPath('imagesBackfill') }],
      endpoints,
      custom: {
        ...config.custom,
        payloadImages: {
          options: opts,
          sourceSlug,
          variantSlug,
          basePath,
          pixelStep,
          maxInputPixels: transformCfg.maxInputPixels ?? DEFAULT_CONSTRAINTS.maxInputPixels,
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

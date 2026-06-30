import type { CollectionConfig, Config, ImageSize, Plugin } from 'payload'

import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'
import { createImagesCollection, imageEnhancements } from './collections/images'
import { createPurgeEndpoint, createTransformEndpoint, type TransformEndpointConfig } from './endpoints/transform'
import { mergeCollection } from './lib/mergeCollection'

export interface ImagesPluginOptions {
  /**
   * When false, the plugin registers NO collections, endpoints, or hooks. This is
   * "not installed", not "temporarily disabled": on SQL adapters, flipping it off for
   * an existing project produces a migration that DROPS the images / generated-images
   * tables (and their data). Defaults to true.
   */
  enabled?: boolean
  /**
   * Slug of an EXISTING upload collection to add the image pipeline to (focal UI, the
   * `variants` join, the purge hooks, and `upload.focalPoint`), instead of creating the
   * default `images` collection. Use this when your project already has a `media`/`images`
   * upload collection — no second collection, no migration. The target must be an upload
   * collection. `pregenerateSizes` is ignored in this mode (you own the collection's sizes).
   */
  extendCollection?: string
  /**
   * Override for the Images collection. Top-level keys replace, but
   * `upload`/`access`/`admin` are deep-merged and `fields`/`hooks` are merged. Note
   * `fields` are APPENDED (not replaced) — don't redeclare a base field's `name`
   * (e.g. `alt`/`variants`), or Payload errors on the duplicate. With `extendCollection`,
   * these tweaks are merged onto the target collection instead.
   */
  imagesOverrides?: Partial<CollectionConfig>
  /** Override for the hidden generated-images (variant cache) collection. */
  generatedImagesOverrides?: Partial<CollectionConfig>
  /**
   * Opt into Payload's classic on-upload size ladder instead of on-demand transforms. Off by
   * default — uploads store only the original and every size is generated on demand. `true`
   * uses a built-in 7-size ladder; pass an array for a custom one. Ignored with `extendCollection`.
   */
  pregenerateSizes?: boolean | ImageSize[]
  /** On-demand transform endpoint config. Pass `false` to not register the endpoints. */
  transform?: TransformEndpointConfig | false
  /** Render the focal + ratio-preview field and purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /**
   * Add virtual `src` / `srcset` / `placeholderURL` / `thumbnailURL` fields, computed on read,
   * so optimized URLs ride along in every REST / GraphQL / Local-API response (and through
   * relationship population). Absolute when `serverURL` is set, relative otherwise. Default true.
   */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Ignored with
   *  `extendCollection`. Default false. */
  localizeAlt?: boolean
}

/**
 * Registers the `images` (source) and hidden `generated-images` (variant cache) collections,
 * plus the on-demand transform + purge endpoints.
 *
 * Uploads store only the original; every rendered size is generated the first time a page asks
 * for it (resized and cropped to the focal point set in the admin), then cached in
 * `generated-images` so it's only ever built once. The LQIP placeholder is derived on the
 * frontend by `<ResponsiveImage>` from the smallest transform variant — nothing is stored on
 * the source doc.
 *
 * Pass `extendCollection: '<slug>'` to add the pipeline to an upload collection you already have
 * instead of creating `images`. The transform endpoint mounts at `/api/img`; do not name a
 * collection `img` or it shadows the endpoint.
 */
export const imagesPlugin =
  (opts: ImagesPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      extendCollection,
      imagesOverrides,
      generatedImagesOverrides,
      pregenerateSizes = false,
      transform = {},
      focalUI = true,
      previewRatios,
      virtualFields = true,
      localizeAlt = false,
    } = opts
    if (!enabled) return config

    const transformCfg: TransformEndpointConfig = transform === false ? {} : transform
    const variantSlug = transformCfg.variantSlug || GENERATED_IMAGES_SLUG
    // With extendCollection, the source IS that collection; otherwise the default `images`.
    const sourceSlug = extendCollection || transformCfg.sourceSlug || 'images'
    const basePath = '/img'
    const purgePath = `${basePath}/purge`

    const generated = mergeCollection(createGeneratedImagesCollection({ slug: variantSlug, sourceSlug }), generatedImagesOverrides)

    let collections: CollectionConfig[]
    if (extendCollection) {
      const target = (config.collections ?? []).find((c) => c.slug === extendCollection)
      if (!target) throw new Error(`[payload-images] extendCollection: collection '${extendCollection}' not found`)
      if (!target.upload) throw new Error(`[payload-images] extendCollection: collection '${extendCollection}' is not an upload collection`)
      const enhanced = mergeCollection(
        mergeCollection(target, imageEnhancements({ focalUI, previewRatios, variantSlug, purgePath, virtualFields })),
        imagesOverrides,
      )
      collections = [...(config.collections ?? []).filter((c) => c.slug !== extendCollection), enhanced, generated]
    } else {
      const images = mergeCollection(
        // No transform endpoint → no on-demand thumbnail; fall back to Payload's default.
        createImagesCollection({
          pregenerateSizes,
          focalUI,
          previewRatios,
          variantSlug,
          purgePath,
          virtualFields,
          localizeAlt,
          adminThumbnail: transform === false ? false : undefined,
        }),
        imagesOverrides,
      )
      collections = [...(config.collections ?? []), images, generated]
    }

    const endpoints =
      transform === false
        ? config.endpoints
        : [
            ...(config.endpoints ?? []),
            createPurgeEndpoint({ variantSlug, sourceSlug }),
            createTransformEndpoint({ ...transformCfg, variantSlug, sourceSlug }),
          ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = transform !== false && collections.some((c) => c.slug === baseSegment)

    return {
      ...config,
      collections,
      endpoints,
      // Stash the resolved config so decoupled tooling (an OG/sitemap generator, a CDN purge
      // script, a migration) can read the slugs + options from just `payload`, no import.
      custom: { ...config.custom, payloadImages: { options: opts, sourceSlug, variantSlug, basePath } },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        if (shadowed) {
          payload.logger.warn(
            `[payload-images] a collection is named "${baseSegment}", which shadows the transform endpoint at /api/${baseSegment} — rename the collection so it doesn't collide.`,
          )
        }
        // The endpoint reads originals from cloud/relative storage via an origin; with none set in
        // production, generation 502s. Warn rather than fail (local-disk dev doesn't need it).
        const hasOrigin = Boolean(payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)
        if (transform !== false && process.env.NODE_ENV === 'production' && !hasOrigin) {
          payload.logger.warn(
            "[payload-images] no serverURL / NEXT_PUBLIC_SERVER_URL set — on cloud or relative-URL storage the transform endpoint can't fetch originals (502s). Set serverURL in buildConfig.",
          )
        }
      },
    }
  }

export default imagesPlugin

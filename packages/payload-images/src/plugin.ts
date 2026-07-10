import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CollectionConfig, Config, Plugin } from 'payload'

import { stashConfig } from './lib/configStash'
import { loadSharp } from './transform/sharpInstance'
import { createPurgeEndpoint } from './endpoints/purge'
import { mergeCollection } from './lib/mergeCollection'
import { SHARP_INSTALL_HINT } from './transform/getVariantBytes'
import { DEFAULT_CONSTRAINTS, DEFAULT_PIXEL_STEP } from './transform/params'
import { createImagesCollection, imageEnhancements } from './collections/images'
import { createTransformEndpoint, type TransformEndpointConfig } from './endpoints/transform'
import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'

/** Absolute path to a bundled bin script, resolving the src→dist swap from this module's
 *  own location (so `payload <key>` works both in-workspace and when published). */
function binScriptPath(name: string): string {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

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
   * collection (you own the collection's `upload` config, including any `imageSizes`).
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
   * The project-wide srcset widths, set once and applied uniformly to the API virtual `srcset`
   * and the endpoint's anti-DoS dimension grid (`<ResponsiveImage>` always steps by the default
   * 50 — off-grid widths just snap server-side). Two forms:
   *  - a **number** (default 50): the width increment AND the grid the endpoint snaps requests
   *    to — a bigger step means fewer srcset widths and fewer cached variants.
   *  - an **array**: an explicit, non-linear width ladder (e.g. `[200, 450, 750, 1200, 2000]`)
   *    for the srcset — denser where it matters, fewer entries than a fine linear step. The
   *    endpoint's snap grid then falls back to the default 50, so use ladder widths that are
   *    multiples of 50 (or set `transform.dimensionStep`) to have them pass through unchanged.
   *
   * `transform.maxDimension` caps the largest width in either form.
   */
  pixelStep?: number | number[]
  /** On-demand transform endpoint config. Pass `false` to not register the endpoints. */
  transform?: TransformEndpointConfig | false
  /** Render the focal + ratio-preview field and purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /**
   * Add virtual `src` / `srcset` / `placeholderURL` / `thumbnailURL` fields, computed on read,
   * so optimized URLs ride along in every REST / GraphQL / Local-API response (and through
   * relationship population). Absolute when `serverURL` is set, relative otherwise. Default true;
   * defaults to false with `transform: false` (the URLs would 404 — an explicit true is honored,
   * with a boot warning).
   */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Ignored with
   *  `extendCollection`. Default false. */
  localizeAlt?: boolean
  /**
   * Accepted upload mime types for the `images` collection. Defaults to the raster formats the
   * transform pipeline can process (avif/webp/jpeg/png). Widen it to accept more (e.g. add
   * `'image/svg+xml'`) or narrow it — but the endpoint only meaningfully resizes/crops raster
   * images, so non-raster uploads are stored and served as-is. Ignored with `extendCollection`
   * (you own that collection's `upload.mimeTypes`).
   */
  mimeTypes?: string[]
  /**
   * Enable Payload's native **folder organization** on the managed collection (the created `images`,
   * or the `extendCollection` target) — adds a folder relationship to the schema so editors can
   * organize a large library. Default false.
   */
  folders?: boolean
  /**
   * Cap the *stored* original's longest edge, in px (applied once on upload via Payload's
   * `resizeOptions`). **Off by default — your original stays untouched** (so the collection can
   * double as original storage); set it only to bound storage. Ignored with `extendCollection`.
   */
  maxOriginalSize?: number
}

/**
 * Registers the `images` (source) and hidden `generated-images` (variant cache) collections,
 * plus the on-demand transform + purge endpoints.
 *
 * Uploads store only the original; every rendered size is generated the first time a page asks
 * for it (resized and cropped to the focal point set in the admin), then cached in
 * `generated-images` so it's only ever built once. Placeholders are a quality-tier ladder
 * (five BlurHash strings + two micro-webp data URIs) stored on the doc at upload time; the
 * virtual `croppedBlurHash` field serves each read a finished, focal-cropped placeholder
 * (hash tiers are pure math; webp tiers decode ~1 KB — never the original).
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
      const parity: Partial<CollectionConfig> = {
        ...enh,
        defaultPopulate: {
          ...(enh.defaultPopulate as Record<string, unknown>),
          ...(target.defaultPopulate as Record<string, unknown> | undefined),
        } as CollectionConfig['defaultPopulate'],
        ...(enh.forceSelect || target.forceSelect
          ? {
              forceSelect: {
                ...(enh.forceSelect as Record<string, unknown> | undefined),
                ...(target.forceSelect as Record<string, unknown> | undefined),
              } as CollectionConfig['forceSelect'],
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

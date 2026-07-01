import type { CollectionConfig, Config, Plugin } from 'payload'

import { createGeneratedImagesCollection, GENERATED_IMAGES_SLUG } from './collections/generatedImages'
import { createImagesCollection, imageEnhancements } from './collections/images'
import { createPurgeEndpoint, createTransformEndpoint, type TransformEndpointConfig } from './endpoints/transform'
import { mergeCollection } from './lib/mergeCollection'
import { DEFAULT_CONSTRAINTS, DEFAULT_PIXEL_STEP } from './transform/params'

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
   * The project-wide srcset widths, set once and applied uniformly to the API virtual `srcset`,
   * `<ResponsiveImage>`, and the endpoint's anti-DoS dimension grid. Two forms:
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
   * relationship population). Absolute when `serverURL` is set, relative otherwise. Default true.
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
  /**
   * Inline LQIP placeholder for `<ResponsiveImage>`. A tiny, faithful (per aspect-ratio +
   * focal point) image is generated server-side, base64-inlined behind the real image, and
   * painted instantly with zero network. Pass `false` to disable it project-wide. Defaults:
   * 24px / quality 40 / webp.
   */
  placeholder?: false | PlaceholderConfig
}

/** Inline-LQIP placeholder settings (see {@link ImagesPluginOptions.placeholder}). */
export interface PlaceholderConfig {
  /**
   * Default longest edge of the LQIP, in px. Default 24. Keep it tiny — the LQIP is inlined as
   * base64 in **every** response, so size compounds: ~0.6 KB at 24px, ~2 KB at 48, ~3–4 KB at 64.
   * **24–64 is the sensible range**; past ~64 it stops being a placeholder and bloats payloads.
   */
  width?: number
  /** Encode quality for the LQIP. Default 40 (clamped to 20–70 — LQIPs gain nothing from more). */
  quality?: number
  /** LQIP encode format. Default `webp`. */
  format?: 'webp' | 'jpeg'
  /**
   * Hard ceiling for a per-read width override coming from the **untrusted** external door
   * (`req.context.lqip` / `X-LQIP`): such widths are clamped to this and snapped to a /8 grid.
   * Default 64. The trusted `<ResponsiveImage placeholder={…}>` prop is *not* bound by this
   * (it honors your value up to a typo guard) — raise this only if you let external callers pick
   * larger LQIPs, knowing each px inlines more base64. Recommended ≤ ~96.
   */
  maxWidth?: number
}

/** The resolved placeholder settings stashed for the component, or `false` when disabled. */
export type ResolvedPlaceholder = false | Required<PlaceholderConfig>

/** Fill in the placeholder defaults (24px / q40 / webp / maxWidth 64), or `false` when disabled. */
export const resolvePlaceholder = (p: ImagesPluginOptions['placeholder']): ResolvedPlaceholder =>
  p === false ? false : { width: p?.width ?? 24, quality: p?.quality ?? 40, format: p?.format ?? 'webp', maxWidth: p?.maxWidth ?? 64 }

/**
 * Registers the `images` (source) and hidden `generated-images` (variant cache) collections,
 * plus the on-demand transform + purge endpoints.
 *
 * Uploads store only the original; every rendered size is generated the first time a page asks
 * for it (resized and cropped to the focal point set in the admin), then cached in
 * `generated-images` so it's only ever built once. The LQIP placeholder is generated on demand by
 * `<ResponsiveImage>` (a tiny inline base64, via the same variant cache) — nothing is stored on the
 * source doc.
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
      virtualFields = true,
      localizeAlt = false,
      mimeTypes,
      folders,
      maxOriginalSize,
      placeholder,
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
        mergeCollection(target, imageEnhancements({ focalUI, previewRatios, variantSlug, purgePath, virtualFields, folders })),
        imagesOverrides,
      )
      collections = [...(config.collections ?? []).filter((c) => c.slug !== extendCollection), enhanced, generated]
    } else {
      const images = mergeCollection(
        // No transform endpoint → no on-demand thumbnail; fall back to Payload's default.
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
            // A custom width ladder (array) can't double as the endpoint's numeric snap grid, so the
            // grid falls back to the default; a numeric pixelStep stays coupled to it as before.
            createTransformEndpoint({
              dimensionStep: Array.isArray(pixelStep) ? DEFAULT_PIXEL_STEP : pixelStep,
              ...transformCfg,
              variantSlug,
              sourceSlug,
            }),
          ]

    const baseSegment = basePath.replace(/^\//, '').split('/')[0]
    const shadowed = transform !== false && collections.some((c) => c.slug === baseSegment)

    return {
      ...config,
      collections,
      endpoints,
      // Stash the resolved config so decoupled tooling (an OG/sitemap generator, a CDN purge
      // script, a migration) and `<ResponsiveImage>` (inline LQIP) can read the slugs + options
      // from just `payload`, no import.
      custom: {
        ...config.custom,
        payloadImages: {
          options: opts,
          sourceSlug,
          variantSlug,
          basePath,
          pixelStep,
          placeholder: resolvePlaceholder(placeholder),
          maxInputPixels: transformCfg.maxInputPixels ?? DEFAULT_CONSTRAINTS.maxInputPixels,
        },
      },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        if (shadowed) {
          payload.logger.warn(
            `[payload-images] a collection is named "${baseSegment}", which shadows the transform endpoint at /api/${baseSegment} — rename the collection so it doesn't collide.`,
          )
        }
      },
    }
  }

export default imagesPlugin

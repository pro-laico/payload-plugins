import type { CollectionConfig } from 'payload'

import type { CollectionOption } from '../../_kit'
import type { PresetSpec } from '../presets/preset'
import type { PrewarmOptions } from '../prewarm/options'
import type { TransformEndpointConfig } from '../transform/transformEndpoint'

/** The images collection's own knobs — everything about the managed upload collection itself. */
export interface ImagesCollectionOptions {
  /** The focal-point picker, preset manager, and variants panel. `false` leaves a clean upload
   * collection, and the import map isn't needed. */
  focalUI?: false | { previewRatios?: string[] }
  /** Payload's native folder organization on the managed collection, so editors can organize a
   * large library. On by default — a managed image library without organization is the wrong default. */
  folders?: boolean
  /** Defaults to whether the app configures localization — a localized site localizes its alt text.
   * Flipping this on an existing collection is a data migration; set it explicitly to opt out. */
  localizeAlt?: boolean
  /** Accepted upload MIME types. */
  mimeTypes?: string[]
  /** Max accepted upload size in bytes. */
  maxOriginalSize?: number
}

/** The render engine — the transform endpoint, its prewarming, and the variant/preset ladder. */
export interface ImagesOptions {
  /** The transform endpoint's limits and defaults.
   *
   * - `maxDimension`
   * - `qualityRange`
   * - `defaultQuality`
   * - `formats`
   * - `defaultFormat`
   * - `preferAvif`
   * - `maxInputPixels`
   * - `cdnCacheControl`
   * - `maxConcurrency`
   * - `sharpConcurrency`
   * - `fallback` */
  transform?: TransformEndpointConfig
  /** Pre-generate the variants the site actually serves. On by default; `false` opts out.
   *
   * - `seeds`
   * - `formats`
   * - `maxVariantsPerImage`
   * - `autoRun`
   * - `queue` */
  prewarm?: false | PrewarmOptions
  /** Width ladder for generated `srcset`s — a step size, or explicit widths. */
  pixelStep?: number | number[]
  /** Named render specs, guaranteed to exist and exempt from `variantLimit`.
   *
   * - `width`
   * - `height`
   * - `aspectRatio`
   * - `fit`
   * - `quality`
   * - `format` */
  presetTemplates?: Record<string, PresetSpec>
  /** Max cached variants per image before new sizes are served from a nearby one instead. */
  variantLimit?: number
}

export interface ImagesPluginOptions {
  /** Register nothing when false — no collections, endpoints, or hooks. Default `true`. */
  enabled?: boolean
  /** The collections this plugin registers.
   *
   * - `images`
   * - `generatedImages`
   * - `renderProfiles` */
  collections?: {
    /** The managed image library — its own knobs under `options`, Payload passthrough under `overrides`. */
    images?: CollectionOption<ImagesCollectionOptions>
    /** The generated-images (variant cache) collection — `slug` renames it. */
    generatedImages?: CollectionOption
    /** The render-profiles collection prewarming records its observations in. Only registered while
     * `options.prewarm` is on, which is what governs its existence. */
    renderProfiles?: CollectionOption
  }
  /** The render engine's limits and behavior.
   *
   * - `transform`
   * - `prewarm`
   * - `pixelStep`
   * - `presetTemplates`
   * - `variantLimit` */
  options?: ImagesOptions
}

/** Mirrors {@link ImagesCollectionOptions}, defaults applied. */
export interface ResolvedImagesCollectionOptions {
  focalUI: false | { previewRatios: string[] | undefined }
  folders: boolean
  localizeAlt: boolean
  mimeTypes: string[] | undefined
  maxOriginalSize: number | undefined
}

/** Mirrors {@link ImagesOptions}, defaults applied. */
export interface ResolvedImagesOptions {
  transform: TransformEndpointConfig
  prewarm: false | PrewarmOptions
  pixelStep: number | number[]
  presetTemplates: Record<string, PresetSpec>
  variantLimit: number
}

/** Mirrors {@link ImagesPluginOptions} key for key, with the defaults applied. */
export interface ResolvedImagesPluginOptions {
  enabled: boolean
  collections: {
    images: { slug: string | undefined; overrides: Partial<CollectionConfig> | undefined; options: ResolvedImagesCollectionOptions }
    generatedImages: { slug: string | undefined; overrides: Partial<CollectionConfig> | undefined }
    renderProfiles: { slug: string | undefined; overrides: Partial<CollectionConfig> | undefined }
  }
  options: ResolvedImagesOptions
}

import type { CollectionConfig } from 'payload'

import type { PresetSpec } from '../presets/preset'
import type { PrewarmOptions } from '../prewarm/options'
import type { TransformEndpointConfig } from '../transform/transformEndpoint'

export interface ImagesCollectionsOptions {
  /** Merged onto the images collection. `slug` is not overridable — every internal reference
   * (join field, purge hooks, endpoints) is bound to the resolved slug. */
  images?: Omit<Partial<CollectionConfig>, 'slug'>
  /** Merged onto the generated-images (variant cache) collection. `slug` is not overridable. */
  generatedImages?: Omit<Partial<CollectionConfig>, 'slug'>
}

export interface ImagesAdminOptions {
  /** The focal-point picker, preset manager, and variants panel. `false` leaves a clean upload
   * collection, and the import map isn't needed. */
  focalUI?: false | { previewRatios?: string[] }
  /** Payload's native folder organization on the managed collection, so editors can organize a
   * large library. On by default — a managed image library without organization is the wrong default. */
  folders?: boolean
}

export interface ImagesPluginOptions {
  /** Register nothing when false — no collections, endpoints, or hooks. Default `true`. */
  enabled?: boolean
  /** Put the image fields on an existing upload collection instead of registering `images`. */
  extendCollection?: string
  /** The collections this plugin registers.
   *
   * - `images`
   * - `generatedImages` */
  collections?: ImagesCollectionsOptions
  /** Admin-only toggles.
   *
   * - `focalUI`
   * - `folders` */
  admin?: ImagesAdminOptions
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
  /** Defaults to whether the app configures localization — a localized site localizes its alt text.
   * Flipping this on an existing collection is a data migration; set it explicitly to opt out. */
  localizeAlt?: boolean
  /** Accepted upload MIME types. Ignored under `extendCollection` — you own that upload config. */
  mimeTypes?: string[]
  /** Max accepted upload size in bytes. Ignored under `extendCollection`. */
  maxOriginalSize?: number
}

export interface ResolvedImagesOptions {
  enabled: boolean
  extendCollection: string | undefined
  images: Omit<Partial<CollectionConfig>, 'slug'> | undefined
  generatedImages: Omit<Partial<CollectionConfig>, 'slug'> | undefined
  focalUI: boolean
  previewRatios: string[] | undefined
  folders: boolean
  transform: TransformEndpointConfig
  pixelStep: number | number[]
  variantLimit: number
  localizeAlt: boolean
  mimeTypes: string[] | undefined
  maxOriginalSize: number | undefined
}

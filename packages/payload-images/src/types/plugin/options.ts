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
  enabled?: boolean
  extendCollection?: string
  collections?: ImagesCollectionsOptions
  admin?: ImagesAdminOptions
  transform?: TransformEndpointConfig
  prewarm?: false | PrewarmOptions
  pixelStep?: number | number[]
  presetTemplates?: Record<string, PresetSpec>
  variantLimit?: number
  /** Defaults to whether the app configures localization — a localized site localizes its alt text.
   * Flipping this on an existing collection is a data migration; set it explicitly to opt out. */
  localizeAlt?: boolean
  mimeTypes?: string[]
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

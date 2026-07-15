import type { CollectionConfig } from 'payload'

import type { PresetSpec } from '../presets/preset'
import type { PrewarmOptions } from '../prewarm/options'
import type { TransformEndpointConfig } from '../transform/transformEndpoint'

export interface ImagesPluginOptions {
  enabled?: boolean
  extendCollection?: string
  /** Merged onto the images collection. `slug` is not overridable — every internal reference
   * (join field, purge hooks, endpoints) is bound to the resolved slug. */
  imagesOverrides?: Omit<Partial<CollectionConfig>, 'slug'>
  /** Merged onto the generated-images (variant cache) collection. `slug` is not overridable. */
  generatedImagesOverrides?: Omit<Partial<CollectionConfig>, 'slug'>
  pixelStep?: number | number[]
  transform?: TransformEndpointConfig | false
  focalUI?: boolean | { previewRatios?: string[] }
  virtualFields?: boolean
  localizeAlt?: boolean
  mimeTypes?: string[]
  folders?: boolean
  maxOriginalSize?: number
  prewarm?: boolean | PrewarmOptions
  variantLimit?: number
  presetTemplates?: Record<string, PresetSpec>
}

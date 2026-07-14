import type { CollectionConfig } from 'payload'

import type { PresetSpec } from '../presets/preset'
import type { PrewarmOptions } from '../prewarm/options'
import type { TransformEndpointConfig } from '../transform/transformEndpoint'

export interface ImagesPluginOptions {
  enabled?: boolean
  extendCollection?: string
  imagesOverrides?: Partial<CollectionConfig>
  generatedImagesOverrides?: Partial<CollectionConfig>
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

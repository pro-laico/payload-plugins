export interface CreateImagesOptions {
  focalUI?: boolean
  previewRatios?: string[]
  variantSlug?: string
  purgePath?: string
  adminThumbnail?: number | false
  apiRoute?: string
  endpointsEnabled?: boolean
  virtualFields?: boolean
  localizeAlt?: boolean
  mimeTypes?: string[]
  folders?: boolean
  maxOriginalSize?: number
  prewarm?: { taskSlug: string; queue: string } | false
  variantLimit?: number
  presetTemplates?: Record<string, import('../presets/preset').PresetSpec>
  presetGen?: import('../../hooks/collection/generatePresets').GeneratePresetsOptions | false
}

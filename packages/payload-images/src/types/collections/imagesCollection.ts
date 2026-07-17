export interface CreateImagesOptions {
  focalUI?: boolean
  previewRatios?: string[]
  variantSlug?: string
  purgePath?: string
  apiRoute?: string
  localizeAlt?: boolean
  mimeTypes?: string[]
  folders?: boolean
  maxOriginalSize?: number
  prewarm?: { taskSlug: string; queue: string } | false
  /** Set only when prewarm is on — its presence is the panel's prewarm-UI gate. */
  prewarmPath?: string
  /** The panel's preset↔variant match endpoint. */
  presetsPath?: string
  variantLimit?: number
  presetTemplates?: Record<string, import('../presets/preset').PresetSpec>
  presetGen?: import('../../hooks/collection/generatePresets').GeneratePresetsOptions
}

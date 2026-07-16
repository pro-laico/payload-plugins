import { DEFAULT_WIDTH_LADDER } from './lib/transform/params'
import { DEFAULT_VARIANT_LIMIT } from './lib/presets/defaults'
import type { ImagesPluginOptions, ResolvedImagesOptions } from './types'

/** The config facts a default depends on. Kept to the minimum the plugin can hand over. */
export interface ImagesOptionsContext {
  /** Whether the app configures localization — decides `localizeAlt`. */
  localized: boolean
}

export function resolveOptions(options: ImagesPluginOptions = {}, ctx: ImagesOptionsContext = { localized: false }): ResolvedImagesOptions {
  const focalUI = options.admin?.focalUI
  return {
    enabled: options.enabled ?? true,
    extendCollection: options.extendCollection,
    images: options.collections?.images,
    generatedImages: options.collections?.generatedImages,
    focalUI: focalUI !== false,
    previewRatios: focalUI ? focalUI.previewRatios : undefined,
    folders: options.admin?.folders ?? true,
    transform: options.transform ?? {},
    pixelStep: options.pixelStep ?? DEFAULT_WIDTH_LADDER,
    variantLimit: options.variantLimit ?? DEFAULT_VARIANT_LIMIT,
    // A localized site localizes its alt text; that's an accessibility fact, not a preference.
    localizeAlt: options.localizeAlt ?? ctx.localized,
    mimeTypes: options.mimeTypes,
    maxOriginalSize: options.maxOriginalSize,
  }
}

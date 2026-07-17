import { DEFAULT_WIDTH_LADDER } from './lib/transform/params'
import { resolvePresetTemplates, DEFAULT_VARIANT_LIMIT } from './lib/presets/defaults'
import type { ImagesPluginOptions, ResolvedImagesPluginOptions } from './types'

/** The config facts a default depends on. Kept to the minimum the plugin can hand over. */
export interface ImagesOptionsContext {
  /** Whether the app configures localization — decides `localizeAlt`. */
  localized: boolean
}

export function resolveOptions(
  options: ImagesPluginOptions = {},
  ctx: ImagesOptionsContext = { localized: false },
): ResolvedImagesPluginOptions {
  const images = options.collections?.images
  const generatedImages = options.collections?.generatedImages
  const renderProfiles = options.collections?.renderProfiles
  const engine = options.options
  const focalUI = images?.options?.focalUI
  return {
    enabled: options.enabled ?? true,
    collections: {
      images: {
        slug: images?.slug,
        overrides: images?.overrides,
        options: {
          focalUI: focalUI === false ? false : { previewRatios: focalUI ? focalUI.previewRatios : undefined },
          folders: images?.options?.folders ?? true,
          // A localized site localizes its alt text; that's an accessibility fact, not a preference.
          localizeAlt: images?.options?.localizeAlt ?? ctx.localized,
          mimeTypes: images?.options?.mimeTypes,
          maxOriginalSize: images?.options?.maxOriginalSize,
        },
      },
      generatedImages: { slug: generatedImages?.slug, overrides: generatedImages?.overrides },
      renderProfiles: { slug: renderProfiles?.slug, overrides: renderProfiles?.overrides },
    },
    options: {
      transform: engine?.transform ?? {},
      prewarm: engine?.prewarm ?? {},
      pixelStep: engine?.pixelStep ?? DEFAULT_WIDTH_LADDER,
      presetTemplates: resolvePresetTemplates(engine?.presetTemplates),
      variantLimit: engine?.variantLimit ?? DEFAULT_VARIANT_LIMIT,
    },
  }
}

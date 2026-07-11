// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions, TransformEndpointConfig } from './types'

// The read-side render contract: declare the render on the fetch (`context: { image, blur }`),
// select RESPONSIVE_IMAGE_SELECT, hand the doc's fields to <ResponsiveImage>.
export { RESPONSIVE_IMAGE_SELECT } from './lib/renderIntent'
export type {
  AspectRatio,
  BlurRenderIntent,
  ImageGetter,
  ImageRenderContext,
  ImageRenderIntent,
  ResponsiveImageDoc,
} from './types'
export type { Fit, Format, OutputFormat } from './types'

// Placeholders: the quality tiers, the request shape the virtual `croppedBlurHash` field
// answers to, and the pure crop/render helpers.
export { coverCropWindow } from './lib/placeholders/window'
export type { CropWindow } from './types'
export { blurhashToPngDataUri } from './lib/placeholders/png'
export type { ImagePalette, PaletteSwatch } from './types'
export { cropBlurhashCoefficients } from './lib/placeholders/cropCoefficients'
export type { BlurhashRequest } from './types'
export type { PlaceholderFormat } from './lib/placeholders/qualities'
export type { BlurhashQuality, PlaceholderQuality, WebpQuality } from './lib/placeholders/qualities'
export { BLURHASH_QUALITIES, DEFAULT_BLURHASH_QUALITY, WEBP_QUALITIES } from './lib/placeholders/qualities'

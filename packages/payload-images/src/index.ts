// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions } from './plugin'
export type { TransformEndpointConfig } from './endpoints/transform'

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
} from './lib/renderIntent'
export type { Fit, Format, OutputFormat } from './lib/transform/params'

// Placeholders: the quality tiers, the request shape the virtual `croppedBlurHash` field
// answers to, and the pure crop/render helpers.
export { coverCropWindow } from './lib/placeholders/window'
export type { CropWindow } from './lib/placeholders/window'
export { blurhashToPngDataUri } from './lib/placeholders/png'
export type { ImagePalette, PaletteSwatch } from './lib/metadata/palette'
export { cropBlurhashCoefficients } from './lib/placeholders/cropCoefficients'
export type { BlurhashRequest, PlaceholderFormat } from './fields/croppedBlurhash'
export type { BlurhashQuality, PlaceholderQuality, WebpQuality } from './lib/placeholders/qualities'
export { BLURHASH_QUALITIES, DEFAULT_BLURHASH_QUALITY, WEBP_QUALITIES } from './lib/placeholders/qualities'

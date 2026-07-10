// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions } from './plugin'

// Type-only (erased at build), so this pulls no endpoint runtime into the root entry.
export type { TransformEndpointConfig } from './endpoints/transform'

// The read-side render contract: declare the render on the fetch (`context: { image, blur }`),
// select RESPONSIVE_IMAGE_SELECT, hand the doc's fields to <ResponsiveImage>. ImageGetter is the
// shape of the getter a project writes around payload.findByID (its own caching/access — never
// the plugin's); ImageProps (exported from ./components/image) is the app wrapper's prop type.
export { RESPONSIVE_IMAGE_SELECT } from './lib/renderIntent'
export type {
  AspectRatio,
  BlurRenderIntent,
  ImageGetter,
  ImageRenderContext,
  ImageRenderIntent,
  ResponsiveImageDoc,
} from './lib/renderIntent'

// Placeholders: the quality tiers (blurhash `xs`…`xl` + micro-webp `xxl`/`x3`), the request
// shape the virtual `croppedBlurHash` field answers to, and the pure crop/render helpers.
export { coverCropWindow } from './blurhash/window'
export type { CropWindow } from './blurhash/window'
export { blurhashToPngDataUri } from './blurhash/png'
export type { ImagePalette, PaletteSwatch } from './metadata/palette'
export { cropBlurhashCoefficients } from './blurhash/cropCoefficients'
export type { BlurhashRequest, PlaceholderFormat } from './fields/croppedBlurhash'
export type { BlurhashQuality, PlaceholderQuality, WebpQuality } from './blurhash/qualities'
export { BLURHASH_QUALITIES, DEFAULT_BLURHASH_QUALITY, WEBP_QUALITIES } from './blurhash/qualities'

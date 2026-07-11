// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions, TransformEndpointConfig } from './types'

// Smart prewarm: learn served render profiles, warm new/changed images via a deferred Payload Job.
export { IMAGE_RENDER_PROFILES_SLUG } from './collections/renderProfiles'
export { PREWARM_TASK_SLUG } from './lib/prewarm/resolveOptions'
export type { PrewarmOptions, PrewarmReason, RenderProfileSeed } from './types'

// The read-side render contract: declare the render on the fetch (`context: { image, blur }`),
// select RESPONSIVE_IMAGE_SELECT, hand the doc's fields to <ResponsiveImage>.
export { RESPONSIVE_IMAGE_SELECT } from './lib/renderIntent'
// The Sanity-style helper around it: seed once with the app's Payload handle, chain the render.
export { createImageFor } from './lib/imageFor'
export type { ImageFor, ImageForChain, ImageSource } from './types'
export type {
  AspectRatio,
  BlurRenderIntent,
  ImageGetter,
  ImageRenderContext,
  ImageRenderIntent,
  ResponsiveImageDoc,
} from './types'
export type { Fit, Format, OutputFormat } from './types'

// Placeholders: the quality tiers, the request shape the virtual `placeholder` field
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

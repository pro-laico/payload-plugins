// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions, TransformEndpointConfig } from './types'

// Smart prewarm: learn served render profiles, warm new/changed images via a deferred Payload Job.
export { PREWARM_TASK_SLUG } from './lib/prewarm/resolveOptions'
export type { PrewarmOptions, RenderProfileSeed } from './types'

// Guaranteed presets + the per-image variant cap.
export type { PresetEntry, PresetSpec } from './types'

// The read-side render contract: declare the render on the fetch (`context: { image, blur }`),
// select RESPONSIVE_IMAGE_SELECT, hand the doc's fields to <ResponsiveImage>.
export { RESPONSIVE_IMAGE_SELECT } from './lib/renderIntent'
// The Sanity-style helper around it: seed once with the app's Payload handle, chain the render.
export { createImageFor } from './lib/imageFor'
export type { ImageFor, ImageForChain, ImageSource } from './types'
export type { AspectRatio, BlurRenderIntent, ImageRenderContext, ImageRenderIntent, ResponsiveImageDoc } from './types'
export type { Fit, Format, OutputFormat } from './types'

// The image doc's stored palette + the placeholder tier/answer-form unions the render contract uses.
export type { ImagePalette, PaletteSwatch } from './types'
export type { PlaceholderFormat, PlaceholderQuality } from './lib/placeholders/qualities'

// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions } from './plugin'

// Type-only (erased at build), so this pulls no endpoint runtime into the root entry.
export type { TransformEndpointConfig } from './endpoints/transform'

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

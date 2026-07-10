// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions } from './plugin'
// Type-only (erased at build), so this pulls no endpoint runtime into the root entry.
export type { TransformEndpointConfig } from './endpoints/transform'

// Placeholders: the quality tiers (blurhash `xs`…`xl` + micro-webp `xxl`/`x3`), the request
// shape the virtual `croppedBlurHash` field answers to, and the pure crop/render helpers.
export { BLURHASH_QUALITIES, DEFAULT_BLURHASH_QUALITY, WEBP_QUALITIES } from './blurhash/qualities'
export type { BlurhashQuality, PlaceholderQuality, WebpQuality } from './blurhash/qualities'
export type { BlurhashRequest, PlaceholderFormat } from './fields/croppedBlurhash'
export { cropBlurhashCoefficients } from './blurhash/cropCoefficients'
export { coverCropWindow } from './blurhash/window'
export type { CropWindow } from './blurhash/window'
export { blurhashToPngDataUri } from './blurhash/png'
export type { ImagePalette, PaletteSwatch } from './metadata/palette'

// NOTE: the frontend surface is intentionally NOT re-exported here. This root entry pulls the
// server-only plugin (which statically imports `node:fs` / `next/server`), so importing the
// frontend from root would drag that into the consumer's bundle. Import it from the subpaths:
//   import { ResponsiveImage } from '@pro-laico/payload-images/components/image'  // async server component
//   import { getImageUrl }      from '@pro-laico/payload-images/utils/urls'       // pure, client-safe builders

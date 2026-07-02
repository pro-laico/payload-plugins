// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions, PlaceholderConfig, ResolvedPlaceholder } from './plugin'
// Type-only (erased at build), so this pulls no endpoint runtime into the root entry.
export type { TransformEndpointConfig } from './endpoints/transform'

// NOTE: the frontend surface is intentionally NOT re-exported here. This root entry pulls the
// server-only plugin (which statically imports `node:fs` / `next/server`), so importing the
// frontend from root would drag that into the consumer's bundle. Import it from the subpaths:
//   import { ResponsiveImage } from '@pro-laico/payload-images/components/image'  // async server component
//   import { getImageUrl }      from '@pro-laico/payload-images/utils/urls'       // pure, client-safe builders

// The plugin
export { default, imagesPlugin } from './plugin'
export type { ImagesPluginOptions } from './plugin'

// NOTE: the frontend surface is intentionally NOT re-exported here. `ResponsiveImage` and the
// URL builders are meant to run in client trees too, but this root entry pulls the server-only
// plugin (which statically imports `node:fs` / `next/server`). Importing them from root would
// drag that into a client bundle and break it. Import them from the client-safe subpaths:
//   import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
//   import { getImageUrl }      from '@pro-laico/payload-images/components/buildSrcset'

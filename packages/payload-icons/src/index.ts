// The plugin — the single entry point.
export { iconsPlugin, default } from './plugin'
export type { IconsPluginOptions } from './plugin'

// The SVG-optimizing beforeChange hook — attach it to your own collection for the same behavior.
export { formatSVGHook } from './hooks/formatSVG'

// SVG string helpers — inline an icon's `svgString` as a real `<svg>` when you're rendering it
// yourself (e.g. with the active-set resolvers from the `./cache` subpath):
//   <svg {...extractSvgProps(svg)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }} />
export { extractSvgContent, extractSvgProps } from './lib/extractSVG'

// Seed integration — declare icons as seed assets for @pro-laico/payload-seed.
export { iconAssets } from './seed'
export type { IconAssetSpec, IconAssetsOptions } from './seed'

// Types (the override shapes are the surface of IconsPluginOptions).
export type { IconAccess, IconCollectionOverrides, IconDoc } from './types'
export type { IconSetCollectionOverrides } from './collections/IconSet'
export type { IconRequestCollectionOverrides } from './collections/IconRequest'

// NOTE: server-only / Next-coupled / React entry points are exposed via subpaths to keep them out
// of this server/config module: the drop-in `<Icon name="…" />` server component is `./components/Icon`,
// the active-set resolvers (`getActiveIconSet` / `getIconSvg`) are `./cache`, the build-time scan +
// manifest API is `./scan`, and the admin field components are `./admin/*`.

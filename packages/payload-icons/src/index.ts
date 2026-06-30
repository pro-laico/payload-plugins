// The plugin
export { iconsPlugin, default } from './plugin'
export type { IconsPluginOptions } from './plugin'

// Collection factories, for advanced consumers assembling their own config
export { Icon, ICON_SLUG } from './collections/Icon'
export {
  createIconSetCollection,
  ICON_SET_SLUG,
  IconRowLabelPath,
  IconSet,
  IconUsagePanelPath,
  type IconSetCollectionOverrides,
} from './collections/IconSet'
export { createIconRequestCollection, ICON_REQUEST_SLUG, IconRequest, type IconRequestCollectionOverrides } from './collections/IconRequest'

// The SVG-optimizing beforeChange hook — attach it to your own collection for the same behavior
export { formatSVGHook } from './hooks/formatSVG'

// SVG string helpers — inline an icon's `svgString` as a real `<svg>` when you're rendering it
// yourself (client components, CVA wrappers, many-at-once). The `<Icon>` component uses these:
//   <svg {...extractSvgProps(svg)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }} />
export { extractSvgContent, extractSvgProps } from './lib/extractSVG'

// Server-side lookup: fetch a stored icon by name (flat filename lookup on the icon collection —
// the low-level escape hatch for rendering many icons in one query or outside the active set)
export { getIcon } from './lib/getIcon'
export type { GetIconOptions } from './lib/getIcon'

// Seed integration — declare icons as seed assets for @pro-laico/payload-seed
export { iconAssets } from './seed'
export type { IconAssetSpec, IconAssetsOptions } from './seed'

// Types
export type { IconAccess, IconCollectionOverrides, IconDoc } from './types'

// NOTE: server-only / Next-coupled / React entry points are exposed via subpaths to keep them out
// of this server/config module: the drop-in `<Icon name="…" />` server component is `./components/Icon`,
// the active-set cache resolvers are `./cache`, the build-time scan + manifest API is `./scan`, and
// the admin field components are `./admin/*`.

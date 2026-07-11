// The plugin — the single entry point.
export { iconsPlugin, default } from './plugin'

// Public types, re-exported so consumers can type options/helpers without deep imports.
export type { IconCollectionOverrides, IconDoc, IconRequestCollectionOverrides, IconSetCollectionOverrides, IconsPluginOptions } from './types'

// SVG string helpers — inline an icon's `svgString` as a real `<svg>` when rendering it yourself
// (e.g. with `getIconSvg` from the `./cache` subpath):
//   <svg {...extractSvgProps(svg)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }} />
export { extractSvgContent, extractSvgProps } from './lib/extractSVG'

// NOTE: server-only / Next-coupled / React entry points are exposed via subpaths to keep them out of
// this server/config module: the drop-in `<Icon name="…" />` server component is `./components/Icon`,
// the active-set resolver `getIconSvg` is `./cache`, and the admin field components are `./admin/*`.

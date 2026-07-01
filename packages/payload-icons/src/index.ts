// The plugin
export { iconsPlugin, default } from './plugin'

// The collection factory, for advanced consumers assembling their own config
export { Icon } from './collections/Icon'

// The SVG-optimizing beforeChange hook — attach it to your own collection for the same behavior
export { formatSVGHook } from './hooks/formatSVG'

// SVG string helpers — inline an icon's `svgString` as a real `<svg>` when you're rendering it
// yourself (client components, CVA wrappers, many-at-once). The `<Icon>` component uses these:
//   <svg {...extractSvgProps(svg)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }} />
export { extractSvgContent, extractSvgProps } from './lib/extractSVG'

// Server-side lookup: fetch a stored icon by name (the <Icon> component uses this, or call it
// directly to fetch many icons in one query)
export { getIcon } from './lib/getIcon'
export type { GetIconOptions } from './lib/getIcon'

// Icons seed like any collection via @pro-laico/payload-seed — `defineCollectionSeed('icon', …)`
// with each SVG on the record's `_file` meta-key. No icon-specific helper needed.

// Types
export type { IconAccess, IconDoc, IconsPluginOptions } from './types'

// NOTE: the drop-in `<Icon name="…" />` server component is exported from the `./components/Icon`
// subpath only (it pulls in React), to keep React/JSX out of this server/config entry point.

export { iconsPlugin, default } from './plugin'

export type { IconDoc, IconSetOptions, IconsCollectionsOptions, IconsPluginOptions } from './types'

// The typed view of `config.custom.payloadIcons` — the supported way to discover the slugs the
// plugin registered, which follow `collections.<name>.slug`.
export { readIconsMarker } from './lib/marker'
export type { PayloadIconsMarker } from './types'

export { extractSvgContent, extractSvgProps } from './lib/extractSVG'

export { default, fontsPlugin } from './plugin'

// The typed view of `config.custom.payloadFonts` — the supported way to discover the slugs the
// plugin registered, which follow `collections.<name>.slug`.
export { readFontsMarker } from './lib/marker'
export type { PayloadFontsMarker } from './types'

export type { FontFamilyConfig } from './types'
export { DEFAULT_FONT_FAMILIES } from './lib/families'

export { extractFonts } from './extractFonts'
export type { ActiveFace, ActiveTypeface } from './types'
export { buildFontFaceCss, getActiveFontFaces } from './lib/activeFonts'

export type { ExportFamilyDiagnostics, ExportFontsResponse } from './types'

export { default, fontsPlugin } from './plugin'

export type { FontFamilyConfig } from './types'
export { DEFAULT_FONT_FAMILIES } from './lib/families'

export { extractFonts } from './extractFonts'
export type { ActiveFace, ActiveTypeface } from './types'
export { buildFontFaceCss, getActiveFontFaces } from './lib/activeFonts'

export type { ExportFamilyDiagnostics, ExportFontsResponse } from './types'

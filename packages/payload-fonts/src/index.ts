// The plugin
export { default, fontsPlugin } from './plugin'
export type { FontsPluginOptions } from './plugin'

// Server-side ingest — create a `font` typeface from a local file / URL (imports, migrations)
export { ingestFont } from './lib/ingest'
export type { IngestFontOptions } from './lib/ingest'

// Declarative seeding — register `font` as a @pro-laico/payload-seed asset provider
export { fontAssetProvider, fontSource } from './seed'
export type { FontAssetProvider, FontAssetProviderOptions, FontSourceTokenOptions } from './seed'

// Frontend serving. The dev-only runtime component lives at the `@pro-laico/payload-fonts/DevFonts`
// subpath; `extractFonts` collects the generated next/font/local classes for `<html>`. The two
// helpers below are the building blocks behind DevFonts, exposed for custom / framework-agnostic
// runtime serving (build the `@font-face` CSS from the active selection yourself).
export { extractFonts } from './extractFonts'
export { buildFontFaceCss, getActiveFontFaces } from './lib/activeFonts'
export type { ActiveFace, ActiveTypeface, BuildFontFaceCssOptions, FontRole, GetActiveFontFacesOptions } from './lib/activeFonts'

// Response shape of `GET /api/fonts/export` — read by the download CLI and any custom consumer.
export type { ExportedFont, ExportFontsResponse } from './endpoints/exportFonts'

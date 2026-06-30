// The plugin
export { default, fontsPlugin } from './plugin'
export type { FontsPluginOptions } from './plugin'

// Server-side ingest — create a `font` typeface from a local file / URL (imports, migrations)
export { ingestFont } from './lib/ingest'
export type { IngestFontOptions } from './lib/ingest'

// Declarative seeding — register `font` as a @pro-laico/payload-seed asset provider
export { fontAssetProvider, fontSource } from './seed'
export type { FontAssetProvider, FontAssetProviderOptions, FontSourceTokenOptions } from './seed'

// Frontend helper — collect the generated next/font/local CSS-variable classes for `<html>`
export { extractFonts } from './extractFonts'

// Dev-only runtime font loading lives at the `@pro-laico/payload-fonts/DevFonts` subpath (a server
// component). These are the building blocks behind it, for custom runtime font serving.
export { buildFontFaceCss, FONT_ROLES, getActiveFontFaces } from './lib/activeFonts'
export type { ActiveFace, ActiveTypeface, BuildFontFaceCssOptions, FontRole, GetActiveFontFacesOptions } from './lib/activeFonts'

// ── Advanced ────────────────────────────────────────────────────────────────────────────────
// Most projects only need the exports above. The rest are for assembling a custom config by hand
// or reading the export endpoint's response shape.

// The fonts export endpoint + its response types (the download CLI and custom consumers read these)
export { exportFontsEndpoint } from './endpoints/exportFonts'
export type { ExportedFont, ExportFontsEndpointOptions, ExportFontsResponse } from './endpoints/exportFonts'

// Collection / global factories + their slugs, for composing the collections yourself
export { createFontCollection } from './collections/font'
export type { CreateFontCollectionOptions } from './collections/font'
export { createFontOriginalCollection, FONT_MIME_TYPES, FONT_ORIGINAL_SLUG } from './collections/fontOriginal'
export { createFontOptimizedCollection, FONT_OPTIMIZED_SLUG } from './collections/fontOptimized'
export type { CreateFontOptimizedCollectionOptions } from './collections/fontOptimized'
export { createFontSetGlobal, FONT_SET_SLUG } from './globals/fontSet'

// The plugin
export { default, fontsPlugin } from './plugin'

// Font families (slots). `FontFamilyConfig` is the `{ key, label?, fallback? }` shape you pass to
// `fontsPlugin({ families })`; spread `DEFAULT_FONT_FAMILIES` to extend the built-in set.
export { DEFAULT_FONT_FAMILIES } from './lib/families'
export type { FontFamilyConfig } from './lib/families'

// Server-side ingest — create a `font` typeface from a local file / URL (imports, migrations).
export { ingestFont } from './lib/ingest'

// Declarative seeding — register `font` as a @pro-laico/payload-seed asset provider.
export { fontAssetProvider } from './seed'
export type { FontAssetProvider, FontAssetProviderOptions } from './seed'

// Frontend serving. The dev-only runtime component lives at the `@pro-laico/payload-fonts/DevFonts`
// subpath; `extractFonts` collects the generated next/font/local classes for `<html>`;
// `getActiveFontFaces` resolves the active `fontSet` selection to its served files (the read behind
// DevFonts, for custom UIs that list or serve the active fonts).
export { extractFonts } from './extractFonts'
export { getActiveFontFaces } from './lib/activeFonts'

// Response shape of `GET /api/fonts/export` — for custom consumers of the endpoint.
export type { ExportFontsResponse } from './endpoints/exportFonts'

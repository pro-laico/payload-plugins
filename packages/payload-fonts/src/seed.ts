/**
 * Seed integration glue for `@pro-laico/payload-seed`. This is plain configuration — it does
 * NOT import the seed package (so this plugin stays decoupled from it) and does NOT touch
 * `fontkit` / `subset-font` (the upload + subset happen in this plugin's collection hooks). It
 * just tells the seed engine that `font` is an asset provider: a typeface is declared with a
 * `fontSource('Inter.woff2')` token and seeded like an image asset, through the normal seed
 * run — no custom script.
 *
 *   seedPlugin({ definitions: [fonts, fontSet], assetProviders: [fontAssetProvider()] })
 *
 *   defineSeed('font', () => [{ _key: 'inter', title: 'Inter', family: 'sans', source: fontSource('inter.woff2') }])
 *   defineGlobalSeed('fontSet', ({ ref }) => ({ sans: ref('font', 'inter') }))
 */

/** Shape consumed by the seed plugin's `assetProviders` option. Matched structurally. */
export interface FontAssetProvider {
  /** Builder token name used by {@link fontSource} (e.g. `({ source }) => …` is not needed —
   *  call `fontSource(...)` directly). */
  token: string
  /** The `font` typeface collection these sources are ingested into. Cleared via
   *  `payload.delete` so its `afterDelete` cascade removes the original + optimized uploads. */
  collection: string
  /** Subdirectory under the seed assets dir holding the source font files. */
  sourceDir?: string
}

export interface FontAssetProviderOptions {
  /** Builder token name (must match {@link fontSource}'s token). @default 'font' */
  token?: string
  /** The `font` collection slug (match `fontOptions.slug` if you renamed it). @default 'font' */
  collection?: string
  /** Subdirectory under the seed assets dir holding font files. @default 'fonts' */
  sourceDir?: string
}

/**
 * Register `font` as a seed asset provider. The provider is plain config: the seed package
 * never imports this one, and this one never imports the seed package — alignment is by the
 * `source` field contract on the `font` collection.
 */
export const fontAssetProvider = (options: FontAssetProviderOptions = {}): FontAssetProvider => ({
  token: options.token ?? 'font',
  collection: options.collection ?? 'font',
  sourceDir: options.sourceDir ?? 'fonts',
})

/** Per-file options carried by a {@link fontSource} token — spread onto the `source` value the
 *  `font` collection's ingest hook consumes. */
export interface FontSourceTokenOptions {
  /** Static-weight value for the created `weights` row. @default '400' (ignored when `variable`). */
  weight?: string
  /** Style of the file; selects the variable upright/italic slot too. @default 'normal' */
  style?: 'normal' | 'italic'
  /** Treat the file as a variable font (fills the `variable` group instead of a `weights` row). */
  variable?: boolean
}

/**
 * A source-file token for the `font` provider collection, structurally a `@pro-laico/payload-seed`
 * `SourceRef`. Declare a seeded typeface's file with it; the seed engine resolves the file under
 * the provider's `sourceDir` and hands `{ file, ...options }` to the `font` collection's ingest
 * hook (which uploads + subsets it). Mirrors the mux plugin's `video('clip.mp4')`.
 *
 *   defineSeed('font', () => [{ _key: 'inter', title: 'Inter', family: 'sans', source: fontSource('inter.woff2', { weight: '400' }) }])
 */
export const fontSource = (
  file: string,
  options: FontSourceTokenOptions = {},
  token = 'font',
): { readonly __seedRef: 'source'; readonly token: string; readonly file: string; readonly options: FontSourceTokenOptions } => ({
  __seedRef: 'source',
  token,
  file,
  options,
})

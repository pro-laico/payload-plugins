/**
 * Seed integration glue for `@pro-laico/payload-seed`. This is plain configuration — it does
 * NOT import the seed package (so this plugin stays decoupled from it) and does NOT touch
 * `fontkit` / `subset-font` (the upload + subset happen in this plugin's collection hooks). It
 * just tells the seed engine that `font` is an asset provider: a doc's `_file` is resolved under
 * the source dir and handed to the collection's `source` field, whose `beforeValidate` hook uploads
 * it to `fontOriginal` and subsets it into a served `fontOptimized` WOFF2 — through the normal seed
 * run, no custom script.
 *
 *   seedPlugin({ definitions: [fonts, fontSet], assetProviders: [fontAssetProvider()] })
 *
 *   defineCollectionSeed('font', ({ file }) => [
 *     { _key: 'inter', _file: file('inter.woff2', { weight: '400' }), title: 'Inter', family: 'sans' },
 *   ])
 *   defineGlobalSeed('fontSet', ({ ref }) => ({ sans: ref('font', 'inter') }))
 *
 * The `_file` options (`weight` / `style` / `variable`) are merged into the `source` value the
 * `font` collection's ingest hook consumes.
 */

/** Shape consumed by the seed plugin's `assetProviders` option. Matched structurally. */
export interface FontAssetProvider {
  /** The `font` typeface collection these sources are ingested into. Cleared via
   *  `payload.delete` so its `afterDelete` cascade removes the original + optimized uploads. */
  collection: string
  /** Subdirectory under the seed assets dir holding the source font files. */
  subdir?: string
}

export interface FontAssetProviderOptions {
  /** The `font` collection slug (match `fontOptions.slug` if you renamed it). @default 'font' */
  collection?: string
  /** Subdirectory under the seed assets dir holding font files. @default 'fonts' */
  subdir?: string
}

/**
 * Register `font` as a seed asset provider. Plain config: the seed package never imports this one,
 * and this one never imports the seed package — alignment is by the `source` field contract on the
 * `font` collection.
 */
export const fontAssetProvider = (options: FontAssetProviderOptions = {}): FontAssetProvider => ({
  collection: options.collection ?? 'font',
  subdir: options.subdir ?? 'fonts',
})

/**
 * Seed integration glue for `@pro-laico/payload-seed`. This is plain configuration — it does
 * NOT import the seed package (so this plugin stays decoupled from it) and does NOT touch the
 * Mux SDK (the upload happens in this plugin's collection hook). It just tells the seed engine
 * that `mux-video` is an asset provider: a doc's `_file` is resolved under the source dir and
 * handed to the collection's `source` field, whose `beforeValidate` hook uploads it to Mux —
 * seeded like an image, through the normal seed run, no custom script.
 */

/** Shape consumed by the seed plugin's `assetProviders` option. Matched structurally. */
export interface MuxAssetProvider {
  /** The collection source videos are ingested into. Cleared via `payload.delete` so its
   *  `afterDelete` hook removes the Mux asset too. */
  collection: string
  /** Subdirectory under the seed assets dir holding the source video files. */
  subdir?: string
}

export interface MuxAssetProviderOptions {
  /** The `mux-video` collection slug (match `extendCollection` if you renamed it). @default 'mux-video' */
  collection?: string
  /** Subdirectory under the seed assets dir holding video files. @default 'video' */
  subdir?: string
}

/**
 * Register `mux-video` as a seed asset provider:
 *
 *   seedPlugin({ definitions: [videos, pages], assetProviders: [muxAssetProvider()] })
 *
 * Then a video is seeded like any doc, with its file on the `_file` meta-key:
 *
 *   defineCollectionSeed('mux-video', ({ file }) => [{ _key: 'intro', _file: file('intro.mp4'), title: 'Intro' }])
 *   defineCollectionSeed('pages', ({ ref }) => [{ _key: 'home', heroVideo: ref('mux-video', 'intro') }])
 */
export const muxAssetProvider = (options: MuxAssetProviderOptions = {}): MuxAssetProvider => ({
  collection: options.collection ?? 'mux-video',
  subdir: options.subdir ?? 'video',
})

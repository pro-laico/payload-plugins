/**
 * Seed integration glue for `@pro-laico/payload-seed`. This is plain configuration — it does
 * NOT import the seed package (so this plugin stays decoupled from it) and does NOT touch the
 * Mux SDK (the upload happens in this plugin's collection hook). It just tells the seed engine
 * that `mux-video` is an asset provider: videos are declared with a `video('clip.mp4')` source
 * token and seeded like image assets, through the normal seed run — no custom script.
 */

/** Shape consumed by the seed plugin's `assetProviders` option. Matched structurally. */
export interface MuxAssetProvider {
  /** Builder token name exposed in seed files (e.g. `({ video }) => …`). */
  token: string
  /** The collection these source videos are ingested into. Cleared via `payload.delete` so its
   *  `afterDelete` hook removes the Mux asset too. */
  collection: string
  /** Subdirectory under the seed assets dir holding the source video files. */
  sourceDir?: string
}

export interface MuxAssetProviderOptions {
  /** Builder token name exposed in seed files. @default 'video' */
  token?: string
  /** The `mux-video` collection slug (match `extendCollection` if you renamed it). @default 'mux-video' */
  collection?: string
  /** Subdirectory under the seed assets dir holding video files. @default 'video' */
  sourceDir?: string
}

/**
 * Register `mux-video` as a seed asset provider:
 *
 *   seedPlugin({ definitions: [videos, pages], assetProviders: [muxAssetProvider()] })
 *
 * Then in a seed file a video is declared like an image asset and referenced anywhere:
 *
 *   defineSeed('mux-video', ({ video }) => [{ _key: 'intro', title: 'Intro', source: video('intro.mp4') }])
 *   defineSeed('pages', ({ ref }) => [{ _key: 'home', heroVideo: ref('mux-video', 'intro') }])
 */
export const muxAssetProvider = (options: MuxAssetProviderOptions = {}): MuxAssetProvider => ({
  token: options.token ?? 'video',
  collection: options.collection ?? 'mux-video',
  sourceDir: options.sourceDir ?? 'video',
})

import type { SeedAssetProvider, SeedDefinition } from './types'

export interface SeedPluginOptions {
  /** The seed definitions (from `defineSeed` / `defineGlobalSeed` / `defineAssets`).
   *  They feed both the seed run and the typed `SeedRegistry` injected into
   *  `payload-types.ts`. */
  definitions?: SeedDefinition[]
  /** Source assets. `dir` holds the files (default `assets`); `collection` is the upload
   *  collection they're created in (default `media`). */
  assets?: { dir?: string; collection?: string }
  /** External-asset providers (e.g. `muxAssetProvider()` from `@pro-laico/payload-mux`) that
   *  let a plugin's collection seed source files like image assets — declared with a source
   *  token (e.g. `video('clip.mp4')`) and run by the normal seed flow. */
  assetProviders?: SeedAssetProvider[]
  /** Show the "Seed your database" button in the admin header. Default: false. */
  adminButton?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedSeedOptions {
  definitions?: SeedDefinition[]
  assetsDir: string
  assetsCollection: string
  assetProviders: SeedAssetProvider[]
  adminButton: boolean
}

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    definitions: options.definitions,
    assetsDir: options.assets?.dir ?? 'assets',
    assetsCollection: options.assets?.collection ?? 'media',
    assetProviders: options.assetProviders ?? [],
    adminButton: options.adminButton ?? false,
  }
}

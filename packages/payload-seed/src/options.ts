import type { SeedAssetProvider, SeedDefinition } from './types'

export interface SeedPluginOptions {
  /** The seed definitions (from `defineCollectionSeed` / `defineGlobalSeed`). They feed both the
   *  seed run and the typed `SeedRegistry` injected into `payload-types.ts`. */
  definitions?: SeedDefinition[]
  /** The assets root where `_file` source files live, relative to the project root
   *  (default `assets`). Native uploads are searched under it (and its `image`/`svg`/… subdirs);
   *  providers look under their own subdir. */
  assetsDir?: string
  /** Asset providers (e.g. `muxAssetProvider()` from `@pro-laico/payload-mux`) — collections whose
   *  `_file` bytes are ingested by an external service via the collection's own hook rather than
   *  stored as a Payload upload. */
  assetProviders?: SeedAssetProvider[]
  /** Show the "Seed your database" button in the admin header. Default: false. */
  adminButton?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedSeedOptions {
  definitions?: SeedDefinition[]
  assetsDir: string
  assetProviders: SeedAssetProvider[]
  adminButton: boolean
}

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    definitions: options.definitions,
    assetsDir: options.assetsDir ?? 'assets',
    assetProviders: options.assetProviders ?? [],
    adminButton: options.adminButton ?? false,
  }
}

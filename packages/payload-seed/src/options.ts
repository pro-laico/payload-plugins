import type { CollectionSlug } from 'payload'
import type { SeedAssetProvider, SeedDefinition } from './types'

export interface SeedPluginOptions {
  /** The seed definitions (from `defineSeed`). They feed both the
   *  seed run and the typed `SeedRegistry` injected into `payload-types.ts`. */
  definitions?: SeedDefinition[]
  /** The assets root where `_file` source files live, relative to the project root (default
   *  `assets`). A native upload's file is looked up under its per-collection subdir (see
   *  {@link assetSubDirs}) and then the root; providers look under their own subdir. */
  assetsDir?: string
  /** Per-collection subdirectory (under `assetsDir`) for a native upload collection's `_file`
   *  source files. Defaults to the collection slug — `media` resolves under `<assetsDir>/media/` —
   *  so name a folder after the collection and it just works. Set an entry to use a different folder
   *  name, e.g. `{ media: 'images' }`. A `_file` name may also include a relative subpath under the
   *  resolved folder (`file('portraits/jane.jpg')`) to subdivide further. */
  assetSubDirs?: Partial<Record<CollectionSlug, string>>
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
  assetSubDirs: Partial<Record<string, string>>
  assetProviders: SeedAssetProvider[]
  adminButton: boolean
}

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    definitions: options.definitions,
    assetsDir: options.assetsDir ?? 'assets',
    assetSubDirs: options.assetSubDirs ?? {},
    assetProviders: options.assetProviders ?? [],
    adminButton: options.adminButton ?? false,
  }
}

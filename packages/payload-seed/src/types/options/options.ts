import type { CollectionSlug } from 'payload'
import type { SeedDefinition } from '../definitions/definitions'

export interface SeedPluginOptions {
  /** The seed definitions (from `defineSeed`). They feed both the
   *  seed run and the typed `SeedRegistry` injected into `payload-types.ts`. */
  definitions?: SeedDefinition[]
  /** The assets root where `_file` source files live, relative to the project root (default
   *  `assets`). A file is looked up under its per-collection subdir (see {@link assetSubDirs},
   *  defaulting to the collection slug) and then the root — the same for native uploads and
   *  `custom.seedAsset` collections. */
  assetsDir?: string
  /** Per-collection subdirectory (under `assetsDir`) for a native upload collection's `_file`
   *  source files. Defaults to the collection slug — `media` resolves under `<assetsDir>/media/` —
   *  so name a folder after the collection and it just works. Set an entry to use a different folder
   *  name, e.g. `{ media: 'images' }`. A `_file` name may also include a relative subpath under the
   *  resolved folder (`file('portraits/jane.jpg')`) to subdivide further. */
  assetSubDirs?: Partial<Record<CollectionSlug, string>>
  /** Show the "Seed your database" button in the admin header. Default: false. */
  adminButton?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedSeedOptions {
  definitions?: SeedDefinition[]
  assetsDir: string
  assetSubDirs: Partial<Record<string, string>>
  adminButton: boolean
}

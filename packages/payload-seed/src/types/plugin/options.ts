import type { CollectionSlug } from 'payload'
import type { SeedDefinition } from '../definitions/definitions'

export interface SeedPluginOptions {
  /** Register nothing when false — no command, endpoint, button, or type augmentation. Default `true`. */
  enabled?: boolean
  /** Your `defineSeed` exports. Feeds both the seed run and the typed `SeedRegistry`. */
  definitions?: SeedDefinition[]
  /** Root for `_file` source files, relative to the project. Default `'assets'`. */
  assetsDir?: string
  /** Per-collection subdirectory under `assetsDir`. Defaults to the collection slug. */
  assetSubDirs?: Partial<Record<CollectionSlug, string>>
}

export interface ResolvedSeedOptions {
  enabled: boolean
  definitions?: SeedDefinition[]
  assetsDir: string
  assetSubDirs: Partial<Record<string, string>>
}

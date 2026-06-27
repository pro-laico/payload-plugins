import type { SeedDefinition } from './types'

export interface SeedPluginOptions {
  /** The seed definitions (from `defineSeed` / `defineGlobalSeed` / `defineAssets`).
   *  They feed both the seed run and the typed `SeedRegistry` injected into
   *  `payload-types.ts`. */
  definitions?: SeedDefinition[]
  /** Source assets. `dir` holds the files (default `assets`); `collection` is the upload
   *  collection they're created in (default `media`). */
  assets?: { dir?: string; collection?: string }
  /** Show the "Seed your database" button in the admin header. Default: false. */
  adminButton?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedSeedOptions {
  definitions?: SeedDefinition[]
  assetsDir: string
  assetsCollection: string
  adminButton: boolean
}

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    definitions: options.definitions,
    assetsDir: options.assets?.dir ?? 'assets',
    assetsCollection: options.assets?.collection ?? 'media',
    adminButton: options.adminButton ?? false,
  }
}

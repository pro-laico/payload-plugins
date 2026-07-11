import type { ResolvedSeedOptions, SeedPluginOptions } from './types'

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    definitions: options.definitions,
    assetsDir: options.assetsDir ?? 'assets',
    assetSubDirs: options.assetSubDirs ?? {},
    adminButton: options.adminButton ?? false,
  }
}

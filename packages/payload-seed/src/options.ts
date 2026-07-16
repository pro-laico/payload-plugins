import type { ResolvedSeedOptions, SeedPluginOptions } from './types'

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    enabled: options.enabled ?? true,
    definitions: options.definitions,
    assetsDir: options.assetsDir ?? 'assets',
    assetSubDirs: options.assetSubDirs ?? {},
  }
}

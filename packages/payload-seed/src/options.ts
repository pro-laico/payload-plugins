import type { ResolvedSeedOptions, SeedPluginOptions } from './types'

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  return {
    enabled: options.enabled ?? true,
    definitions: options.definitions,
    options: {
      assetsDir: options.options?.assetsDir ?? 'assets',
      assetSubDirs: options.options?.assetSubDirs ?? {},
    },
  }
}

import type { FontsPluginOptions, ResolvedFontsOptions } from './types'

export function resolveOptions(options: FontsPluginOptions = {}): ResolvedFontsOptions {
  const collections = options.collections ?? {}
  return {
    enabled: options.enabled ?? true,
    font: collections.font,
    fontOriginal: collections.fontOriginal,
    fontOptimized: collections.fontOptimized,
    fontSet: options.globals?.fontSet ?? {},
    charset: options.charset,
    families: options.families,
  }
}

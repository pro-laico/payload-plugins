import type { FontsPluginOptions, ResolvedFontsOptions } from './types'

export function resolveOptions(options: FontsPluginOptions = {}): ResolvedFontsOptions {
  const cols = options.collections ?? {}
  const fontSet = options.globals?.fontSet
  return {
    enabled: options.enabled ?? true,
    collections: {
      font: { slug: cols.font?.slug, overrides: cols.font?.overrides, options: {} },
      fontOriginal: { slug: cols.fontOriginal?.slug, overrides: cols.fontOriginal?.overrides, options: {} },
      fontOptimized: { slug: cols.fontOptimized?.slug, overrides: cols.fontOptimized?.overrides, options: {} },
    },
    globals: {
      fontSet: fontSet === false ? false : { slug: fontSet?.slug, overrides: fontSet?.overrides, options: {} },
    },
    options: {
      charset: options.options?.charset,
      families: options.options?.families,
    },
  }
}

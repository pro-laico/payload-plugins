import type { IconsPluginOptions, ResolvedIconsOptions } from './types'

export function resolveOptions(options: IconsPluginOptions = {}): ResolvedIconsOptions {
  const collections = options.collections ?? {}
  return {
    enabled: options.enabled ?? true,
    icon: collections.icon ?? {},
    iconSet: collections.iconSet ?? {},
    iconRequest: collections.iconRequest ?? {},
    usagePanel: options.admin?.usagePanel ?? true,
  }
}

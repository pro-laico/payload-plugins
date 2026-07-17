import type { CollectionOption } from './_kit'
import type { IconsPluginOptions, IconSetOptions, ResolvedCollectionOption, ResolvedIconSetOptions, ResolvedIconsOptions } from './types'

const resolveIconSet = (opt: CollectionOption<IconSetOptions>): ResolvedCollectionOption<ResolvedIconSetOptions> => ({
  slug: opt.slug,
  overrides: opt.overrides,
  options: { usagePanel: opt.options?.usagePanel ?? true, iconRowFields: opt.options?.iconRowFields ?? [] },
})

const resolvePlain = (opt: CollectionOption = {}): ResolvedCollectionOption => ({ slug: opt.slug, overrides: opt.overrides, options: {} })

export function resolveOptions(options: IconsPluginOptions = {}): ResolvedIconsOptions {
  const { icon, iconSet, iconRequest } = options.collections ?? {}
  return {
    enabled: options.enabled ?? true,
    collections: {
      icon: resolvePlain(icon),
      iconSet: iconSet === false ? false : resolveIconSet(iconSet ?? {}),
      iconRequest: iconRequest === false ? false : resolvePlain(iconRequest),
    },
  }
}

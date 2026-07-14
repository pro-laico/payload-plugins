import type { IconsPluginOptions } from './plugin-options'

export interface PayloadIconsMarker {
  options: IconsPluginOptions
  iconSlug: string
  iconSetSlug: string | null
  iconRequestSlug: string | null
}

import type { FontsPluginOptions } from './options'

export interface PayloadFontsMarker {
  options: FontsPluginOptions
  fontSlug: string
  fontOriginalSlug: string
  fontOptimizedSlug: string
  fontSetSlug: string | null
  familyKeys: string[]
  exportPath: string
}

import type { CollectionConfig, GlobalConfig } from 'payload'

import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface FontsCollectionsOptions {
  font?: Partial<CollectionConfig>
  fontOriginal?: Partial<CollectionConfig>
  fontOptimized?: Partial<CollectionConfig>
}

export interface FontsGlobalsOptions {
  /** `false` skips the fontSet global — nothing declares which font is active per family. */
  fontSet?: false | Partial<GlobalConfig>
}

export interface FontsPluginOptions {
  enabled?: boolean
  collections?: FontsCollectionsOptions
  globals?: FontsGlobalsOptions
  charset?: Charset
  families?: FontFamilyConfig[]
}

export interface ResolvedFontsOptions {
  enabled: boolean
  font: Partial<CollectionConfig> | undefined
  fontOriginal: Partial<CollectionConfig> | undefined
  fontOptimized: Partial<CollectionConfig> | undefined
  fontSet: false | Partial<GlobalConfig>
  charset: Charset | undefined
  families: FontFamilyConfig[] | undefined
}

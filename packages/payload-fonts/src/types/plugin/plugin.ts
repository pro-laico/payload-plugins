import type { CollectionConfig, GlobalConfig } from 'payload'

import type { Charset } from '../subset/charset'
import type { FontFamilyConfig } from '../families/families'

export interface FontsPluginOptions {
  enabled?: boolean
  charset?: Charset
  families?: FontFamilyConfig[]
  fontOverrides?: Partial<CollectionConfig>
  fontOriginalOverrides?: Partial<CollectionConfig>
  fontOptimizedOverrides?: Partial<CollectionConfig>
  includeFontSet?: boolean
  fontSetOverrides?: Partial<GlobalConfig>
}
